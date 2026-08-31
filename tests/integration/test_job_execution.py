from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

import pytest
from hk_data_worker.execution import DatabaseJobExecutor, ExecutionBlocked, connector_run_id
from hk_data_worker.hashing import sha256_hex
from hk_data_worker.models import FetchResult, MonitorTarget, RawObjectRef
from hk_data_worker.monitor.baseline import schema_shape
from hk_data_worker.scheduler import SchedulerJob
from hk_data_worker.storage import DigestOnlyEvidenceStore

NOW = datetime(2026, 8, 28, 10, tzinfo=UTC)
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "connectors"


class Cursor:
    def __init__(self, row: dict[str, object] | None = None) -> None:
        self._row = row

    def fetchone(self) -> dict[str, object] | None:
        return self._row


class FakeConnection:
    def __init__(self, rows: dict[str, dict[str, object] | None]) -> None:
        self.rows = rows
        self.statements: list[str] = []
        self.parameters: list[tuple[object, ...]] = []

    def execute(self, sql: str, parameters: tuple[object, ...]) -> Cursor:
        normalized = " ".join(sql.split())
        self.statements.append(normalized)
        self.parameters.append(parameters)
        for marker, row in self.rows.items():
            if marker in normalized:
                return Cursor(row)
        return Cursor()


class FakeStore:
    def __init__(self) -> None:
        self.puts: list[bytes] = []

    def put(self, body: bytes, media_type: str, retention_class: str) -> RawObjectRef:
        self.puts.append(body)
        digest = sha256_hex(body)
        return RawObjectRef(
            raw_object_id=f"RAW-{digest}",
            object_uri=f"s3://evidence/raw/{digest}.blob",
            sha256=digest,
            media_type=media_type,
            size_bytes=len(body),
            retention_class=retention_class,
        )

    def get(self, reference: RawObjectRef) -> bytes:
        raise AssertionError(f"unexpected reuse of {reference.raw_object_id}")


class ReusableStore(FakeStore):
    def __init__(self, body: bytes) -> None:
        super().__init__()
        self.body = body
        self.gets: list[str] = []

    def get(self, reference: RawObjectRef) -> bytes:
        self.gets.append(reference.raw_object_id)
        assert sha256_hex(self.body) == reference.sha256
        return self.body


class FakeFetcher:
    def __init__(self, body: bytes) -> None:
        self.body = body
        self.calls = 0

    def fetch(self, request: object) -> FetchResult:
        del request
        self.calls += 1
        return FetchResult(
            status_code=200,
            headers={"content-type": "application/json"},
            body=self.body,
            final_url="https://provider.example/data",
            elapsed_ms=12,
        )


class SequenceFetcher:
    def __init__(self, pages: list[tuple[str, bytes]]) -> None:
        self.pages = iter(pages)

    def fetch(self, request: object) -> FetchResult:
        del request
        url, body = next(self.pages)
        return FetchResult(
            status_code=200,
            headers={"content-type": "application/json"},
            body=body,
            final_url=url,
            elapsed_ms=10,
        )


def approval_row(source_id: str) -> dict[str, object]:
    return {
        "approval_id": f"APP-{source_id}-1",
        "source_id": source_id,
        "decision": "approved",
        "projects": ["P01", "P14"],
        "purposes": ["connector-observation", "quality-monitoring"],
        "storage_policy": "immutable raw and normalized metadata",
        "retention_policy": "rights-specific",
        "redistribution_policy": "reviewed fields only",
        "attribution_policy": "provider attribution required",
        "evidence_urls": ["https://example.gov.hk/review/1"],
        "decided_at": NOW - timedelta(days=1),
        "expires_at": NOW + timedelta(days=30),
        "actor": "reviewer@example.gov.hk",
    }


def target() -> MonitorTarget:
    return MonitorTarget(
        monitor_id="P14-M001",
        source_id="HKAPI-001",
        source_group_id="P01-SG-01",
        provider="Provider",
        name="Fixture",
        method="GET",
        request_template="https://provider.example/data",
        request_body_json=None,
        cadence_seconds=60,
        timeout_ms=1_000,
        freshness_rule="retrieval_only",
        required_checks=("availability", "json", "schema"),
        public_visibility="pending_review",
        activation_status="specified_pending_approval",
        documentation_url="https://provider.example/docs",
        notes="fixture",
    )


def test_connector_job_persists_raw_bytes_before_parsing_records() -> None:
    request = json.loads((FIXTURES / "p01-sg-01" / "request.json").read_text())
    body = (FIXTURES / "p01-sg-01" / "response.json").read_bytes()
    connection = FakeConnection(
        {
            "FROM connector_definition": {
                "connector_id": "CONN-001",
                "source_group_id": "P01-SG-01",
                "code_version": "1.0.0",
                "configuration_schema": request["definition"],
            },
            "FROM source_approval": approval_row("HKAPI-001"),
        }
    )
    store = FakeStore()
    executor = DatabaseJobExecutor(
        cast(Any, connection),
        targets={},
        evidence_store=store,
        fetcher=FakeFetcher(body),
        clock=lambda: NOW,
    )

    executor.execute(
        SchedulerJob(
            job_id="JOB-CONN-001",
            job_type="connector",
            target_id="CONN-001",
            due_at=NOW,
            cadence_seconds=60,
            attempt=0,
        )
    )

    raw_insert = next(
        index for index, sql in enumerate(connection.statements) if "INSERT INTO raw_object" in sql
    )
    record_insert = next(
        index
        for index, sql in enumerate(connection.statements)
        if "INSERT INTO source_record" in sql
    )
    assert store.puts == [body]
    assert raw_insert < record_insert
    assert any(
        "status = %s" in sql and "UPDATE connector_run" in sql for sql in connection.statements
    )


def test_connector_run_identity_is_stable_for_the_same_scheduled_checkpoint() -> None:
    scheduled = SchedulerJob(
        job_id="JOB-CONN-001",
        job_type="connector",
        target_id="CONN-001",
        due_at=NOW,
        cadence_seconds=60,
        attempt=0,
    )
    retry = scheduled.model_copy(update={"attempt": 1})

    assert connector_run_id(scheduled, "1.0.0") == connector_run_id(retry, "1.0.0")


def test_monitor_job_runs_shared_fetch_evaluator_and_persistence_path() -> None:
    payload = {"items": [{"id": "A1"}]}
    body = json.dumps(payload).encode()
    connection = FakeConnection(
        {
            "FROM monitor_target AS target": {
                "activation_status": "approved",
                "public_visibility": "private",
                "baseline_id": "BASE-P14-M001-1",
                "baseline_version": 1,
                "content_rules": {
                    "schema_shape": schema_shape(payload),
                    "required_pointers": ["/items"],
                },
                "freshness_rule": "retrieval_only",
                "evidence_observation_ids": ["OBS-BASE-1"],
                "operator_identity": "local-operator",
                "activated_at": NOW,
            },
            "FROM source_approval": approval_row("HKAPI-001"),
            "FROM connector_run AS run": None,
            "FROM incident": None,
        }
    )
    store = FakeStore()
    fetcher = FakeFetcher(body)
    executor = DatabaseJobExecutor(
        cast(Any, connection),
        targets={"P14-M001": target()},
        evidence_store=store,
        fetcher=fetcher,
        clock=lambda: NOW,
    )

    executor.execute(
        SchedulerJob(
            job_id="JOB-MON-001",
            job_type="monitor",
            target_id="P14-M001",
            due_at=NOW,
            cadence_seconds=60,
            attempt=0,
        )
    )

    assert fetcher.calls == 1
    assert store.puts == [body]
    assert any("INSERT INTO monitor_observation" in sql for sql in connection.statements)


def test_monitor_reuses_recent_connector_evidence_without_provider_request() -> None:
    payload = {"items": [{"id": "A1"}]}
    body = json.dumps(payload).encode()
    digest = sha256_hex(body)
    connection = FakeConnection(
        {
            "FROM monitor_target AS target": {
                "activation_status": "approved",
                "public_visibility": "private",
                "baseline_id": "BASE-P14-M001-1",
                "baseline_version": 1,
                "content_rules": {
                    "schema_shape": schema_shape(payload),
                    "required_pointers": ["/items"],
                },
                "freshness_rule": "retrieval_only",
                "evidence_observation_ids": ["OBS-BASE-1"],
                "operator_identity": "local-operator",
                "activated_at": NOW,
            },
            "FROM source_approval": approval_row("HKAPI-001"),
            "FROM connector_run AS run": {
                "connector_run_id": "CR-REUSED",
                "status": "success",
                "finished_at": NOW - timedelta(seconds=30),
                "raw_object_id": f"RAW-{digest}",
                "object_uri": f"s3://evidence/raw/{digest}.blob",
                "sha256": digest,
                "media_type": "application/json",
                "size_bytes": len(body),
                "retention_class": "rights-specific",
            },
            "FROM incident": None,
        }
    )
    store = ReusableStore(body)
    fetcher = FakeFetcher(b"must not be fetched")
    executor = DatabaseJobExecutor(
        cast(Any, connection),
        targets={"P14-M001": target()},
        evidence_store=store,
        fetcher=fetcher,
        clock=lambda: NOW,
    )

    executor.execute(
        SchedulerJob(
            job_id="JOB-MON-001",
            job_type="monitor",
            target_id="P14-M001",
            due_at=NOW,
            cadence_seconds=60,
            attempt=0,
        )
    )

    assert fetcher.calls == 0
    assert store.gets == [f"RAW-{digest}"]
    observation_parameters = next(
        parameters
        for sql, parameters in zip(connection.statements, connection.parameters, strict=True)
        if "INSERT INTO monitor_observation" in sql
    )
    assert observation_parameters[2] == "CR-REUSED"


def test_digest_reference_falls_back_to_a_direct_probe() -> None:
    payload = {"items": [{"id": "A1"}]}
    body = json.dumps(payload).encode()
    digest = sha256_hex(body)
    connection = FakeConnection(
        {
            "FROM monitor_target AS target": {
                "activation_status": "approved",
                "public_visibility": "private",
                "baseline_id": "BASE-P14-M001-1",
                "baseline_version": 1,
                "content_rules": {
                    "schema_shape": schema_shape(payload),
                    "required_pointers": ["/items"],
                },
                "freshness_rule": "retrieval_only",
                "evidence_observation_ids": ["OBS-BASE-1"],
                "operator_identity": "local-operator",
                "activated_at": NOW,
            },
            "FROM source_approval": approval_row("HKAPI-001"),
            "FROM connector_run AS run": {
                "connector_run_id": "CR-DIGEST",
                "status": "success",
                "finished_at": NOW - timedelta(seconds=30),
                "raw_object_id": f"RAW-{digest}",
                "object_uri": f"digest://sha256/{digest}",
                "sha256": digest,
                "media_type": "application/json",
                "size_bytes": len(body),
                "retention_class": "metadata-only",
            },
            "FROM incident": None,
        }
    )
    fetcher = FakeFetcher(body)
    executor = DatabaseJobExecutor(
        cast(Any, connection),
        targets={"P14-M001": target()},
        evidence_store=DigestOnlyEvidenceStore(),
        fetcher=fetcher,
        clock=lambda: NOW,
        evidence_mode="digest",
    )

    executor.execute(
        SchedulerJob(
            job_id="JOB-MON-001",
            job_type="monitor",
            target_id="P14-M001",
            due_at=NOW,
            cadence_seconds=60,
            attempt=0,
        )
    )

    assert fetcher.calls == 1
    assert any("INSERT INTO monitor_observation" in sql for sql in connection.statements)


def test_catalogue_profile_blocks_every_job_before_network_access() -> None:
    fetcher = FakeFetcher(b"{}")
    executor = DatabaseJobExecutor(
        cast(Any, FakeConnection({})),
        targets={"P14-M001": target()},
        evidence_store=DigestOnlyEvidenceStore(),
        fetcher=fetcher,
        clock=lambda: NOW,
        provider_access=False,
        evidence_mode="none",
    )

    with pytest.raises(ExecutionBlocked, match="PROVIDER_ACCESS_DISABLED"):
        executor.execute(
            SchedulerJob(
                job_id="JOB-MON-001",
                job_type="monitor",
                target_id="P14-M001",
                due_at=NOW,
                cadence_seconds=60,
                attempt=0,
            )
        )
    assert fetcher.calls == 0


def test_later_page_quarantine_never_publishes_records_from_earlier_pages() -> None:
    request = json.loads((FIXTURES / "p01-sg-01" / "request.json").read_text())
    request["definition"]["pagination"] = {
        "next_url_pointer": "/links/next",
        "max_pages": 3,
    }
    first_url = request["definition"]["endpoint"]
    second_url = "https://data.gov.hk/data?page=2"
    first = json.dumps(
        {
            "success": True,
            "result": [{"id": "duplicate", "title": "first"}],
            "links": {"next": second_url},
        }
    ).encode()
    second = json.dumps(
        {
            "success": True,
            "result": [{"id": "duplicate", "title": "second"}],
            "links": {"next": None},
        }
    ).encode()
    connection = FakeConnection(
        {
            "FROM connector_definition": {
                "connector_id": "CONN-001",
                "source_group_id": "P01-SG-01",
                "code_version": "1.0.0",
                "configuration_schema": request["definition"],
            },
            "FROM source_approval": approval_row("HKAPI-001"),
        }
    )
    store = FakeStore()
    executor = DatabaseJobExecutor(
        cast(Any, connection),
        targets={},
        evidence_store=store,
        fetcher=SequenceFetcher([(first_url, first), (second_url, second)]),
        clock=lambda: NOW,
    )

    executor.execute(
        SchedulerJob(
            job_id="JOB-CONN-001",
            job_type="connector",
            target_id="CONN-001",
            due_at=NOW,
            cadence_seconds=60,
            attempt=0,
        )
    )

    assert len(store.puts) == 2
    assert not any("INSERT INTO source_record" in sql for sql in connection.statements)
    assert any(
        "UPDATE connector_run" in sql and parameters[0] == "quarantined"
        for sql, parameters in zip(connection.statements, connection.parameters, strict=True)
    )


def test_monitor_activation_gate_blocks_network_access() -> None:
    connection = FakeConnection(
        {
            "FROM monitor_target AS target": {
                "activation_status": "specified_pending_approval",
                "baseline_id": None,
            }
        }
    )
    fetcher = FakeFetcher(b"{}")
    executor = DatabaseJobExecutor(
        cast(Any, connection),
        targets={"P14-M001": target()},
        evidence_store=FakeStore(),
        fetcher=fetcher,
        clock=lambda: NOW,
    )

    with pytest.raises(ExecutionBlocked, match="MONITOR_NOT_ACTIVE"):
        executor.execute(
            SchedulerJob(
                job_id="JOB-MON-001",
                job_type="monitor",
                target_id="P14-M001",
                due_at=NOW,
                cadence_seconds=60,
                attempt=0,
            )
        )
    assert fetcher.calls == 0
