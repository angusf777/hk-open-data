from __future__ import annotations

from datetime import UTC, datetime, timedelta

from hk_data_worker.scheduler import (
    InMemoryJobStore,
    SchedulerJob,
    claim_jobs,
    deactivate_unauthorized_jobs,
    reusable_connector_run,
    scheduler_start_late,
)

NOW = datetime(2026, 8, 28, 10, tzinfo=UTC)


def job(index: int) -> SchedulerJob:
    return SchedulerJob(
        job_id=f"JOB-{index:04d}",
        job_type="monitor",
        target_id=f"P14-M{index:03d}",
        due_at=NOW,
        cadence_seconds=60,
        attempt=0,
    )


def test_two_workers_never_claim_the_same_job_and_expired_leases_recover() -> None:
    store = InMemoryJobStore([job(1), job(2), job(3)])

    first = store.claim(worker_id="worker-a", limit=2, now=NOW, lease_seconds=30)
    second = store.claim(worker_id="worker-b", limit=2, now=NOW, lease_seconds=30)
    recovered = store.claim(
        worker_id="worker-c", limit=3, now=NOW + timedelta(seconds=31), lease_seconds=30
    )

    assert {item.job_id for item in first}.isdisjoint(item.job_id for item in second)
    assert len(first) == 2
    assert len(second) == 1
    assert {item.job_id for item in recovered} == {"JOB-0001", "JOB-0002", "JOB-0003"}


class FakeCursor:
    def __init__(self, rows: list[dict[str, object]] | None = None) -> None:
        self.rows = rows or []

    def fetchall(self) -> list[dict[str, object]]:
        return self.rows


class FakeConnection:
    def __init__(self, rows: list[dict[str, object]] | None = None) -> None:
        self.sql = ""
        self.parameters: tuple[object, ...] = ()
        self.rows = rows or []

    def execute(self, sql: str, parameters: tuple[object, ...]) -> FakeCursor:
        self.sql = sql
        self.parameters = parameters
        return FakeCursor(self.rows)


def test_postgres_claim_uses_skip_locked_lease_update() -> None:
    connection = FakeConnection()

    claimed = claim_jobs(connection, worker_id="worker-a", limit=2, now=NOW, lease_seconds=30)

    assert claimed == []
    assert connection.parameters[2] == 2
    assert "FOR UPDATE SKIP LOCKED" in connection.sql
    assert "UPDATE scheduler_job" in connection.sql
    assert "active = true" in connection.sql


def test_expired_or_revoked_approval_deactivates_schedule_before_claim() -> None:
    row = {
        "job_id": "JOB-CONN-001",
        "job_type": "connector",
        "target_id": "CONN-001",
        "attempt": 2,
    }
    connection = FakeConnection([row])

    deactivated = deactivate_unauthorized_jobs(connection, now=NOW)

    assert deactivated == [row]
    assert "ORDER BY approval.decided_at DESC" in connection.sql
    assert "latest.expires_at > %s" in connection.sql
    assert "SET active = false" in connection.sql
    assert connection.parameters == (NOW, NOW, NOW, NOW, NOW)


def test_recent_successful_connector_run_is_reused_within_cadence() -> None:
    assert reusable_connector_run(
        status="success",
        finished_at=NOW - timedelta(seconds=30),
        now=NOW,
        cadence_seconds=60,
    )
    assert not reusable_connector_run(
        status="failed",
        finished_at=NOW - timedelta(seconds=30),
        now=NOW,
        cadence_seconds=60,
    )


def test_scheduler_marks_start_outside_cadence_window_as_late() -> None:
    scheduled = job(1)
    assert not scheduler_start_late(scheduled, started_at=NOW + timedelta(seconds=30))
    assert scheduler_start_late(scheduled, started_at=NOW + timedelta(seconds=31))
