from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Literal

from ..hashing import sha256_hex
from ..models import (
    CheckResult,
    FetchResult,
    MonitorCheckName,
    MonitorObservation,
    MonitorTarget,
)
from .baseline import MaintenanceWindow, MonitorBaseline, schema_shape
from .checks import (
    freshness_check,
    geometry_checks,
    parse_payload,
    schema_checks,
    semantic_checks,
    values_at,
)


@dataclass(frozen=True)
class FetchFailure:
    code: str
    category: str


def _overall(
    checks: list[CheckResult],
) -> Literal["pass", "degraded", "fail", "maintenance", "suppressed", "unknown"]:
    outcomes = {check.outcome for check in checks}
    if "fail" in outcomes:
        return "fail"
    if "degraded" in outcomes:
        return "degraded"
    if "unknown" in outcomes:
        return "unknown"
    return "pass"


def _observation(
    *,
    target: MonitorTarget,
    baseline: MonitorBaseline,
    clock: datetime,
    checks: list[CheckResult],
    evidence: bytes,
    latency_ms: int = 0,
    http_status: int | None = None,
    provider_timestamp: datetime | None = None,
    freshness_age_seconds: int | None = None,
    schema_fingerprint: str | None = None,
    seeded_failure: bool = False,
    forced_outcome: Literal["maintenance"] | None = None,
) -> MonitorObservation:
    evidence_hash = sha256_hex(evidence)
    return MonitorObservation(
        observation_id=f"OBS-{evidence_hash[:16]}",
        monitor_id=target.monitor_id,
        started_at=clock,
        finished_at=clock,
        outcome=forced_outcome or _overall(checks),
        check_results=tuple(checks),
        latency_ms=latency_ms,
        http_status=http_status,
        provider_timestamp=provider_timestamp,
        freshness_age_seconds=freshness_age_seconds,
        evidence_hash=evidence_hash,
        content_hash=sha256_hex(evidence),
        schema_fingerprint=schema_fingerprint,
        baseline_version=baseline.baseline_version,
        seeded_failure=seeded_failure,
    )


def evaluate(
    target: MonitorTarget,
    fetch_result: FetchResult | FetchFailure,
    baseline: MonitorBaseline,
    clock: datetime,
    *,
    seeded_failure: bool = False,
    maintenance_window: MaintenanceWindow | None = None,
) -> MonitorObservation:
    if maintenance_window is not None and maintenance_window.active(clock):
        evidence = json.dumps(maintenance_window.model_dump(mode="json"), sort_keys=True).encode()
        return _observation(
            target=target,
            baseline=baseline,
            clock=clock,
            checks=[
                CheckResult(
                    check="availability",
                    outcome="not_applicable",
                    code="OPERATOR_MAINTENANCE_WINDOW",
                )
            ],
            evidence=evidence,
            seeded_failure=seeded_failure,
            forced_outcome="maintenance",
        )
    if isinstance(fetch_result, FetchFailure):
        evidence = json.dumps(
            {"category": fetch_result.category, "code": fetch_result.code}, sort_keys=True
        ).encode()
        category = fetch_result.category
        check_by_category: dict[str, MonitorCheckName] = {
            "availability": "availability",
            "media": "media",
            "contract": "contract",
            "redirect": "redirect",
            "hash": "hash",
        }
        check = check_by_category.get(
            category, "redirect" if fetch_result.code == "REDIRECT_BLOCKED" else "media"
        )
        return _observation(
            target=target,
            baseline=baseline,
            clock=clock,
            checks=[
                CheckResult(
                    check=check,
                    outcome="fail",
                    code=fetch_result.code,
                )
            ],
            evidence=evidence,
            seeded_failure=seeded_failure,
        )

    checks: list[CheckResult] = []
    if fetch_result.status_code == 429:
        checks.append(CheckResult(check="availability", outcome="degraded", code="RATE_LIMITED"))
    elif fetch_result.status_code >= 500:
        checks.append(CheckResult(check="availability", outcome="fail", code="HTTP_SERVER_ERROR"))
    elif fetch_result.status_code >= 400:
        checks.append(CheckResult(check="availability", outcome="fail", code="HTTP_CLIENT_ERROR"))
    else:
        checks.append(CheckResult(check="availability", outcome="pass", code="HTTP_OK"))

    expected_media = (
        "application/json" if {"json", "geojson"} & set(target.required_checks) else None
    )
    actual_media = fetch_result.headers.get("content-type", "").split(";", 1)[0].strip()
    if expected_media is not None and actual_media != expected_media:
        checks.append(CheckResult(check="contract", outcome="fail", code="CONTENT_TYPE_MISMATCH"))

    document, payload_result = parse_payload(target, fetch_result.body)
    checks.append(payload_result)
    if document is None:
        return _observation(
            target=target,
            baseline=baseline,
            clock=clock,
            checks=checks,
            evidence=fetch_result.body,
            latency_ms=fetch_result.elapsed_ms,
            http_status=fetch_result.status_code,
            seeded_failure=seeded_failure,
        )

    maintenance = values_at(document, baseline.maintenance_pointer)
    if maintenance and (
        maintenance[0] is True
        or (
            isinstance(maintenance[0], str)
            and maintenance[0] in {"maintenance", "scheduled_maintenance"}
        )
    ):
        return _observation(
            target=target,
            baseline=baseline,
            clock=clock,
            checks=[
                CheckResult(
                    check="availability",
                    outcome="not_applicable",
                    code="PROVIDER_MAINTENANCE_EVIDENCE",
                )
            ],
            evidence=fetch_result.body,
            latency_ms=fetch_result.elapsed_ms,
            http_status=fetch_result.status_code,
            seeded_failure=seeded_failure,
            forced_outcome="maintenance",
        )

    checks.extend(schema_checks(document, baseline))
    checks.extend(semantic_checks(document, baseline))
    checks.extend(geometry_checks(document, baseline))
    freshness, provider_time, age = freshness_check(document, baseline, clock)
    checks.append(freshness)
    fingerprint = sha256_hex(json.dumps(schema_shape(document), sort_keys=True).encode())
    return _observation(
        target=target,
        baseline=baseline,
        clock=clock,
        checks=checks,
        evidence=fetch_result.body,
        latency_ms=fetch_result.elapsed_ms,
        http_status=fetch_result.status_code,
        provider_timestamp=provider_time,
        freshness_age_seconds=age,
        schema_fingerprint=fingerprint,
        seeded_failure=seeded_failure,
    )
