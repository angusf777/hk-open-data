from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, datetime
from hashlib import sha256
from typing import Protocol, cast
from urllib.parse import urlsplit
from uuid import uuid4

import psycopg
from psycopg.rows import dict_row

from .config import EvidenceMode
from .connectors import CONNECTORS
from .connectors.base import ConnectorDefinition, QuarantineRequired, SourceRecordDraft
from .connectors.pagination import next_page_request
from .fetch import BodyTooLarge, EgressDenied, FetchError, FetchTimedOut, SafeFetcher
from .models import (
    Approval,
    ApprovedRequest,
    FetchResult,
    MonitorObservation,
    MonitorTarget,
    RawObjectRef,
)
from .monitor.baseline import MonitorBaseline
from .monitor.evaluator import FetchFailure, evaluate
from .scheduler import SchedulerJob, reusable_connector_run
from .storage import EvidenceBodyUnavailable, EvidenceStore


class ExecutionBlocked(RuntimeError):
    """A safe activation gate prevented provider access."""

    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


class Fetcher(Protocol):
    def fetch(self, request: ApprovedRequest) -> FetchResult: ...


def connector_run_id(job: SchedulerJob, code_version: str) -> str:
    """Return the stable identity for one scheduled connector checkpoint."""
    checkpoint = f"{job.job_id}:{job.target_id}:{job.due_at.isoformat()}:{code_version}"
    return f"CR-{sha256(checkpoint.encode()).hexdigest()[:32].upper()}"


def _mapping(value: object, *, code: str) -> dict[str, object]:
    if not isinstance(value, dict):
        raise ExecutionBlocked(code)
    return {str(key): item for key, item in value.items()}


def _strings(value: object) -> tuple[str, ...]:
    if not isinstance(value, list | tuple):
        return ()
    return tuple(str(item) for item in value)


class DatabaseJobExecutor:
    """Executes activated connector and monitor jobs against durable platform state."""

    def __init__(
        self,
        connection: psycopg.Connection[dict[str, object]],
        *,
        targets: dict[str, MonitorTarget],
        evidence_store: EvidenceStore,
        fetcher: Fetcher | None = None,
        clock: Callable[[], datetime] | None = None,
        provider_access: bool = True,
        evidence_mode: EvidenceMode = "raw",
    ) -> None:
        self._connection = connection
        self._targets = targets
        self._evidence_store = evidence_store
        self._fetcher = fetcher or SafeFetcher()
        self._clock = clock or (lambda: datetime.now(UTC))
        self._provider_access = provider_access
        self._evidence_mode = evidence_mode

    def execute(self, job: SchedulerJob) -> None:
        if not self._provider_access:
            raise ExecutionBlocked("PROVIDER_ACCESS_DISABLED")
        if job.job_type == "connector":
            if self._evidence_mode != "raw":
                raise ExecutionBlocked("FABRIC_PROFILE_REQUIRED")
            self._execute_connector(job)
        else:
            self._execute_monitor(job)

    def _latest_approval(self, source_id: str, *, project: str, purpose: str) -> Approval:
        row = self._connection.execute(
            """
            SELECT approval_id, source_id, decision, projects, purposes,
                   storage_policy, retention_policy, redistribution_policy,
                   attribution_policy, evidence_urls, decided_at, expires_at, actor
            FROM source_approval
            WHERE source_id = %s
            ORDER BY decided_at DESC, approval_id DESC
            LIMIT 1
            """,
            (source_id,),
        ).fetchone()
        if row is None:
            raise ExecutionBlocked("APPROVAL_REQUIRED")
        approval = Approval.model_validate(
            {
                "approval_id": row["approval_id"],
                "source_id": row["source_id"],
                "decision": row["decision"],
                "projects": row["projects"],
                "purposes": row["purposes"],
                "storage": row["storage_policy"],
                "retention": row["retention_policy"],
                "redistribution": row["redistribution_policy"],
                "attribution": row["attribution_policy"],
                "evidence_urls": row["evidence_urls"],
                "decided_at": row["decided_at"],
                "expires_at": row["expires_at"],
                "actor": row["actor"],
            }
        )
        if not approval.authorizes(project=project, purpose=purpose, at=self._clock()):
            raise ExecutionBlocked("APPROVAL_NOT_EFFECTIVE")
        return approval

    def _persist_raw(self, body: bytes, *, media_type: str, retention_class: str) -> RawObjectRef:
        raw = self._evidence_store.put(body, media_type, retention_class)
        self._connection.execute(
            """
            INSERT INTO raw_object (
              raw_object_id, object_uri, sha256, media_type, size_bytes,
              encryption_state, retention_class, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (raw_object_id) DO NOTHING
            """,
            (
                raw.raw_object_id,
                raw.object_uri,
                raw.sha256,
                raw.media_type,
                raw.size_bytes,
                "digest-only" if raw.object_uri.startswith("digest://") else "encrypted",
                raw.retention_class,
                self._clock(),
            ),
        )
        return raw

    def _execute_connector(self, job: SchedulerJob) -> None:
        row = self._connection.execute(
            """
            SELECT connector_id, source_group_id, code_version, configuration_schema
            FROM connector_definition
            WHERE connector_id = %s AND enabled = true
            """,
            (job.target_id,),
        ).fetchone()
        if row is None:
            raise ExecutionBlocked("CONNECTOR_NOT_ACTIVE")
        configuration = _mapping(row["configuration_schema"], code="CONNECTOR_CONFIG_INVALID")
        definition = ConnectorDefinition.model_validate(configuration)
        connector = CONNECTORS.get(str(row["source_group_id"]))
        if connector is None:
            raise ExecutionBlocked("CONNECTOR_FAMILY_UNAVAILABLE")
        approval = self._latest_approval(
            definition.source_id,
            project=definition.project,
            purpose=definition.purpose,
        )
        requests = connector.plan(definition, approval, at=self._clock())
        run_id = connector_run_id(job, str(row["code_version"]))
        started_at = self._clock()
        request_fingerprint = sha256(
            json.dumps(
                [request.model_dump(mode="json") for request in requests],
                sort_keys=True,
                default=str,
            ).encode()
        ).hexdigest()
        self._connection.execute(
            """
            INSERT INTO connector_run (
              connector_run_id, connector_id, source_id, code_version, status,
              started_at, request_fingerprint, response_metadata, created_at
            ) VALUES (%s, %s, %s, %s, 'running', %s, %s, '{}'::jsonb, %s)
            ON CONFLICT (connector_run_id) DO NOTHING
            """,
            (
                run_id,
                row["connector_id"],
                definition.source_id,
                row["code_version"],
                started_at,
                request_fingerprint,
                started_at,
            ),
        )
        raw_ids: list[str] = []
        response_metadata: list[dict[str, object]] = []
        pending_records: list[SourceRecordDraft] = []
        seen_record_keys: set[tuple[str, str]] = set()
        try:
            for initial_request in requests:
                request: ApprovedRequest | None = initial_request
                seen_urls = {initial_request.url}
                completed_pages = 0
                while request is not None:
                    response = self._fetcher.fetch(request)
                    completed_pages += 1
                    media_type = response.headers.get(
                        "content-type", "application/octet-stream"
                    ).split(";", 1)[0]
                    raw = self._persist_raw(
                        response.body,
                        media_type=media_type,
                        retention_class=approval.retention,
                    )
                    raw_ids.append(raw.raw_object_id)
                    response_metadata.append(
                        {
                            "page": completed_pages,
                            "status": response.status_code,
                            "final_url": response.final_url,
                            "elapsed_ms": response.elapsed_ms,
                            "raw_object_id": raw.raw_object_id,
                        }
                    )
                    records = connector.parse(definition, raw, response.body)
                    for record in records:
                        key = (record.source_id, record.record_key)
                        if key in seen_record_keys:
                            raise QuarantineRequired("PAGINATION_DUPLICATE_RECORD")
                        seen_record_keys.add(key)
                        pending_records.append(record)
                    if definition.pagination is None:
                        request = None
                    else:
                        request = next_page_request(
                            request,
                            response,
                            definition.pagination,
                            completed_pages=completed_pages,
                            seen_urls=seen_urls,
                        )
                        if request is not None:
                            seen_urls.add(request.url)
            for record in pending_records:
                self._connection.execute(
                    """
                    INSERT INTO source_record (
                      source_record_id, source_id, connector_run_id, raw_object_id,
                      approval_reference, schema_version, retrieved_at, observed_at,
                      language, freshness_status, quality_flags, record_data, record_hash,
                      parent_source_record_ids, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s,
                              'unknown', '{}', %s, %s, '{}', %s)
                    ON CONFLICT (source_record_id) DO NOTHING
                    """,
                    (
                        record.source_record_id,
                        record.source_id,
                        run_id,
                        record.raw_object_id,
                        approval.approval_id,
                        str(row["code_version"]),
                        self._clock(),
                        record.observed_at,
                        record.language,
                        json.dumps(record.record_data),
                        record.record_hash,
                        self._clock(),
                    ),
                )
        except QuarantineRequired as error:
            self._finish_connector(
                run_id,
                status="quarantined",
                raw_ids=raw_ids,
                response_metadata=response_metadata,
                error_code=str(error)[:100] or "PAYLOAD_QUARANTINED",
            )
            return
        except Exception:
            self._finish_connector(
                run_id,
                status="failed",
                raw_ids=raw_ids,
                response_metadata=response_metadata,
                error_code="FETCH_OR_STORAGE_FAILED",
            )
            return
        self._finish_connector(
            run_id,
            status="success",
            raw_ids=raw_ids,
            response_metadata=response_metadata,
            error_code=None,
        )

    def _finish_connector(
        self,
        run_id: str,
        *,
        status: str,
        raw_ids: list[str],
        response_metadata: list[dict[str, object]],
        error_code: str | None,
    ) -> None:
        self._connection.execute(
            """
            UPDATE connector_run
            SET status = %s, finished_at = %s, raw_object_ids = %s,
                response_metadata = %s, error_code = %s
            WHERE connector_run_id = %s
            """,
            (
                status,
                self._clock(),
                raw_ids,
                json.dumps(response_metadata),
                error_code,
                run_id,
            ),
        )

    def _execute_monitor(self, job: SchedulerJob) -> None:
        target = self._targets.get(job.target_id)
        if target is None:
            raise ExecutionBlocked("MONITOR_NOT_IN_REGISTRY")
        row = self._connection.execute(
            """
            SELECT target.activation_status, target.public_visibility,
                   baseline.baseline_id, baseline.baseline_version,
                   baseline.content_rules, baseline.freshness_rule,
                   baseline.evidence_observation_ids, baseline.operator_identity,
                   baseline.activated_at
            FROM monitor_target AS target
            LEFT JOIN LATERAL (
              SELECT * FROM monitor_baseline
              WHERE monitor_id = target.monitor_id AND retired_at IS NULL
              ORDER BY baseline_version DESC LIMIT 1
            ) AS baseline ON true
            WHERE target.monitor_id = %s
            """,
            (job.target_id,),
        ).fetchone()
        if row is None or row["activation_status"] != "approved":
            raise ExecutionBlocked("MONITOR_NOT_ACTIVE")
        if row["baseline_id"] is None:
            raise ExecutionBlocked("BASELINE_REQUIRED")
        self._latest_approval(target.source_id, project="P14", purpose="quality-monitoring")
        content_rules = _mapping(row["content_rules"], code="BASELINE_INVALID")
        baseline = MonitorBaseline.model_validate(
            {
                **content_rules,
                "baseline_version": str(row["baseline_version"]),
                "operator_identity": row["operator_identity"],
                "activated_at": row["activated_at"],
                "evidence_observation_ids": row["evidence_observation_ids"],
            }
        )
        now = self._clock()
        response, raw, connector_run_id = self._monitor_input(target, now=now)
        observation = evaluate(target, response, baseline, now)
        self._persist_observation(
            observation,
            baseline_id=str(row["baseline_id"]),
            raw=raw,
            connector_run_id=connector_run_id,
        )
        self._apply_incident(target, observation)

    def _monitor_input(
        self, target: MonitorTarget, *, now: datetime
    ) -> tuple[FetchResult | FetchFailure, RawObjectRef | None, str | None]:
        reusable = self._connection.execute(
            """
            SELECT run.connector_run_id, run.status, run.finished_at,
                   raw.raw_object_id, raw.object_uri, raw.sha256, raw.media_type,
                   raw.size_bytes, raw.retention_class
            FROM connector_run AS run
            JOIN raw_object AS raw ON raw.raw_object_id = run.raw_object_ids[1]
            WHERE run.source_id = %s AND run.finished_at IS NOT NULL
            ORDER BY run.finished_at DESC LIMIT 1
            """,
            (target.source_id,),
        ).fetchone()
        if reusable is not None and reusable_connector_run(
            status=str(reusable["status"]),
            finished_at=cast(datetime, reusable["finished_at"]),
            now=now,
            cadence_seconds=target.cadence_seconds,
        ):
            raw = RawObjectRef(
                raw_object_id=str(reusable["raw_object_id"]),
                object_uri=str(reusable["object_uri"]),
                sha256=str(reusable["sha256"]),
                media_type=str(reusable["media_type"]),
                size_bytes=int(str(reusable["size_bytes"])),
                retention_class=str(reusable["retention_class"]),
            )
            try:
                body = self._evidence_store.get(raw)
            except EvidenceBodyUnavailable:
                pass
            else:
                return (
                    FetchResult(
                        status_code=200,
                        headers={"content-type": raw.media_type},
                        body=body,
                        final_url=target.request_template,
                        elapsed_ms=0,
                    ),
                    raw,
                    str(reusable["connector_run_id"]),
                )

        host = urlsplit(target.request_template).hostname
        if host is None:
            raise ExecutionBlocked("MONITOR_ENDPOINT_INVALID")
        request = ApprovedRequest(
            method=target.method,
            url=target.request_template,
            allowed_hosts=(host,),
            timeout_ms=target.timeout_ms,
            max_attempts=3,
            headers={"content-type": "application/json"}
            if target.request_body_json is not None
            else {},
            body=None
            if target.request_body_json is None
            else json.dumps(target.request_body_json, sort_keys=True).encode(),
        )
        try:
            fetched = self._fetcher.fetch(request)
        except FetchTimedOut:
            return FetchFailure(code="FETCH_TIMEOUT", category="availability"), None, None
        except BodyTooLarge:
            return FetchFailure(code="BODY_TOO_LARGE", category="contract"), None, None
        except EgressDenied:
            return FetchFailure(code="EGRESS_DENIED", category="redirect"), None, None
        except FetchError:
            return FetchFailure(code="FETCH_FAILED", category="availability"), None, None
        media_type = fetched.headers.get("content-type", "application/octet-stream").split(";", 1)[
            0
        ]
        raw = self._persist_raw(
            fetched.body,
            media_type=media_type,
            retention_class="monitor-evidence",
        )
        return fetched, raw, None

    def _persist_observation(
        self,
        observation: MonitorObservation,
        *,
        baseline_id: str,
        raw: RawObjectRef | None,
        connector_run_id: str | None,
    ) -> None:
        evidence = observation.model_dump(mode="json")
        if raw is not None:
            evidence["raw_object_id"] = raw.raw_object_id
        self._connection.execute(
            """
            INSERT INTO monitor_observation (
              observation_id, monitor_id, connector_run_id, baseline_id, outcome,
              started_at, finished_at, latency_ms, http_status, schema_fingerprint,
              provider_timestamp, evidence_json, created_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (observation_id) DO NOTHING
            """,
            (
                observation.observation_id,
                observation.monitor_id,
                connector_run_id,
                baseline_id,
                observation.outcome,
                observation.started_at,
                observation.finished_at,
                observation.latency_ms,
                observation.http_status,
                observation.schema_fingerprint,
                observation.provider_timestamp,
                json.dumps(evidence),
                self._clock(),
            ),
        )

    def _apply_incident(self, target: MonitorTarget, observation: MonitorObservation) -> None:
        failed = next(
            (check for check in observation.check_results if check.outcome == "fail"), None
        )
        if failed is None:
            return
        current = self._connection.execute(
            """
            SELECT incident_id, status, observation_ids, audit_version
            FROM incident
            WHERE source_id = %s AND category = %s
              AND status IN ('candidate', 'open', 'acknowledged', 'monitoring')
            ORDER BY last_observed_at DESC LIMIT 1
            """,
            (target.source_id, failed.check),
        ).fetchone()
        critical = failed.code in {"EGRESS_DENIED", "HASH_MISMATCH", "SCHEMA_BREAKING"}
        now = observation.finished_at
        if current is None:
            incident_id = f"INC-{now.year}-{uuid4().hex[:12].upper()}"
            self._connection.execute(
                """
                INSERT INTO incident (
                  incident_id, source_id, status, severity, category, monitor_ids,
                  observation_ids, opened_at, last_observed_at, public_state,
                  audit_version, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s,
                          'review_required', 1, %s, %s)
                """,
                (
                    incident_id,
                    target.source_id,
                    "open" if critical else "candidate",
                    "critical" if critical else "major",
                    failed.check,
                    [target.monitor_id],
                    [observation.observation_id],
                    now,
                    now,
                    now,
                    now,
                ),
            )
            return
        prior_ids = _strings(current["observation_ids"])
        self._connection.execute(
            """
            UPDATE incident
            SET status = CASE WHEN status = 'candidate' THEN 'open' ELSE status END,
                observation_ids = %s, last_observed_at = %s,
                audit_version = audit_version + 1, updated_at = %s
            WHERE incident_id = %s
            """,
            (
                [*prior_ids, observation.observation_id],
                now,
                now,
                current["incident_id"],
            ),
        )


def postgres_connection(database_url: str) -> psycopg.Connection[dict[str, object]]:
    return psycopg.connect(database_url, row_factory=dict_row)
