from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path
from typing import Any, cast

import pytest
from hk_data_worker.scheduler import SchedulerJob
from hk_data_worker.service import (
    RuntimeConfiguration,
    _finish_job,
    load_configuration,
    validate_runtime_contracts,
)

ROOT = Path(__file__).parents[2]
NOW = datetime(2026, 8, 28, 10, tzinfo=UTC)


class RecordingConnection:
    def __init__(self) -> None:
        self.statements: list[str] = []

    def execute(self, sql: str, parameters: tuple[object, ...]) -> object:
        del parameters
        self.statements.append(" ".join(sql.split()))
        return object()


def test_worker_configuration_requires_database_and_contracts() -> None:
    with pytest.raises(ValueError, match="DATABASE_URL"):
        load_configuration({})
    with pytest.raises(ValueError, match="WORKER_POLL_SECONDS"):
        load_configuration(
            {
                "DATABASE_URL": "postgresql://example",
                "SOURCE_GROUPS_PATH": "groups.csv",
                "MONITOR_TARGETS_PATH": "targets.csv",
                "WORKER_POLL_SECONDS": "0",
                "OBJECT_STORE_ENDPOINT": "http://object-store",
                "OBJECT_STORE_BUCKET": "raw",
                "OBJECT_STORE_ACCESS_KEY": "test",
                "OBJECT_STORE_SECRET_KEY": "test",
            }
        )


def test_worker_validates_the_exact_10_group_50_target_runtime_contract() -> None:
    configuration = RuntimeConfiguration(
        database_url="postgresql://example",
        source_groups_path=(
            ROOT / "packages/schemas/contracts/p01-source-groups.csv"
        ),
        monitor_targets_path=(
            ROOT / "packages/schemas/contracts/p14-monitor-targets.csv"
        ),
        ready_path=Path("/tmp/not-created-by-test"),
        poll_seconds=5,
        object_store_endpoint="http://object-store",
        object_store_bucket="raw",
        object_store_access_key="test",
        object_store_secret_key="test",
    )
    assert validate_runtime_contracts(configuration) == (10, 50)


def test_blocked_job_records_scheduler_state_and_append_only_audit_evidence() -> None:
    connection = RecordingConnection()
    job = SchedulerJob(
        job_id="JOB-CONN-001",
        job_type="connector",
        target_id="CONN-001",
        due_at=NOW,
        cadence_seconds=60,
        attempt=0,
        lease_owner="worker-a",
        lease_expires_at=NOW,
    )

    _finish_job(
        cast(Any, connection),
        job,
        worker_id="worker-a",
        now=NOW,
        error_code="APPROVAL_NOT_EFFECTIVE",
    )

    assert any("UPDATE scheduler_job" in sql for sql in connection.statements)
    assert any(
        "scheduler.blocked" in sql and "INSERT INTO audit_entry" in sql
        for sql in connection.statements
    )
