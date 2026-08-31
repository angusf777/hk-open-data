from __future__ import annotations

from datetime import UTC, datetime, timedelta

from hk_data_worker.incidents import IncidentEvaluator
from hk_data_worker.models import CheckResult, MonitorObservation

NOW = datetime(2026, 8, 28, 10, tzinfo=UTC)


def observation(
    sequence: int,
    outcome: str,
    *,
    at: datetime | None = None,
    category: str = "availability",
) -> MonitorObservation:
    occurred = at or NOW + timedelta(minutes=sequence)
    check_outcome = "pass" if outcome == "pass" else "fail"
    return MonitorObservation.model_validate(
        {
            "observation_id": f"OBS-INC{sequence:08d}",
            "monitor_id": "P14-M001",
            "started_at": occurred,
            "finished_at": occurred,
            "outcome": outcome,
            "check_results": [
                CheckResult(check=category, outcome=check_outcome, code=f"CHECK_{outcome.upper()}")
            ],
            "latency_ms": 100,
            "evidence_hash": f"{sequence:064x}",
            "baseline_version": "1",
            "seeded_failure": False,
        }
    )


def test_one_noncritical_failure_is_candidate_and_second_opens() -> None:
    evaluator = IncidentEvaluator(recovery_window=timedelta(minutes=5))

    first = evaluator.apply(observation(1, "fail"), source_id="HKAPI-001", severity="major")
    second = evaluator.apply(observation(2, "fail"), source_id="HKAPI-001", severity="major")

    assert first.action == "candidate_created"
    assert first.incident.status == "candidate"
    assert second.action == "incident_opened"
    assert second.incident.status == "open"
    assert second.incident.incident_id == first.incident.incident_id


def test_critical_failure_opens_immediately() -> None:
    evaluator = IncidentEvaluator(recovery_window=timedelta(minutes=5))

    decision = evaluator.apply(
        observation(1, "fail", category="contract"),
        source_id="HKAPI-001",
        severity="critical",
    )

    assert decision.action == "incident_opened"
    assert decision.incident.status == "open"


def test_acknowledgement_does_not_resolve_and_two_healthy_checks_do() -> None:
    evaluator = IncidentEvaluator(recovery_window=timedelta(minutes=5))
    opened = evaluator.apply(
        observation(1, "fail"), source_id="HKAPI-001", severity="critical"
    ).incident
    acknowledged = evaluator.acknowledge(
        opened.incident_id,
        actor="operator@example.gov.hk",
        reason="owned",
        at=NOW + timedelta(minutes=2),
    )
    first_pass = evaluator.apply(
        observation(3, "pass", at=NOW + timedelta(minutes=3)),
        source_id="HKAPI-001",
        severity="major",
    )
    resolved = evaluator.apply(
        observation(4, "pass", at=NOW + timedelta(minutes=9)),
        source_id="HKAPI-001",
        severity="major",
    )

    assert acknowledged.status == "acknowledged"
    assert first_pass.incident.status == "monitoring"
    assert resolved.action == "incident_resolved"
    assert resolved.incident.status == "resolved"


def test_suppression_expires_and_failure_reopens_same_group() -> None:
    evaluator = IncidentEvaluator(recovery_window=timedelta(minutes=5))
    opened = evaluator.apply(
        observation(1, "fail"), source_id="HKAPI-001", severity="critical"
    ).incident
    suppressed = evaluator.suppress(
        opened.incident_id,
        owner="operator@example.gov.hk",
        reason="planned provider maintenance",
        at=NOW + timedelta(minutes=2),
        expires_at=NOW + timedelta(minutes=10),
    )
    during = evaluator.apply(
        observation(3, "fail", at=NOW + timedelta(minutes=5)),
        source_id="HKAPI-001",
        severity="major",
    )
    after = evaluator.apply(
        observation(4, "fail", at=NOW + timedelta(minutes=11)),
        source_id="HKAPI-001",
        severity="major",
    )

    assert suppressed.status == "suppressed"
    assert during.action == "suppressed"
    assert after.incident.status == "open"
    assert after.incident.incident_id == opened.incident_id
