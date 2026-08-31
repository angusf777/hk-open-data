from __future__ import annotations

import json
import os
import signal
import socket
import time
from datetime import UTC, datetime
from hashlib import sha256
from typing import cast

import psycopg
from boto3 import client as boto3_client  # type: ignore[import-untyped]
from psycopg.rows import dict_row

from .config import RuntimeConfiguration, load_configuration
from .execution import DatabaseJobExecutor, ExecutionBlocked
from .registry import load_monitor_targets, load_source_groups
from .scheduler import (
    SchedulerConnection,
    SchedulerJob,
    claim_jobs,
    deactivate_unauthorized_jobs,
    next_due_at,
    scheduler_start_late,
)
from .storage import DigestOnlyEvidenceStore, EvidenceStore, S3Client, S3EvidenceStore


def validate_runtime_contracts(configuration: RuntimeConfiguration) -> tuple[int, int]:
    groups = load_source_groups(configuration.source_groups_path)
    targets = load_monitor_targets(configuration.monitor_targets_path)
    source_ids = {source_id for group in groups for source_id in group.source_ids}
    invalid_targets = [
        target.monitor_id
        for target in targets
        if target.source_group_id != "P14-ONLY-01" and target.source_id not in source_ids
    ]
    if invalid_targets:
        raise ValueError(f"monitor targets reference unknown P01 sources: {invalid_targets}")
    return len(groups), len(targets)


def _log(event: str, **fields: object) -> None:
    print(json.dumps({"event": event, **fields}, separators=(",", ":")), flush=True)


def _finish_job(
    connection: psycopg.Connection[dict[str, object]],
    job: SchedulerJob,
    *,
    worker_id: str,
    now: datetime,
    error_code: str | None,
) -> None:
    connection.execute(
        """
        UPDATE scheduler_job
        SET due_at = %s, lease_owner = NULL, lease_expires_at = NULL,
            last_error_code = %s, attempt = attempt + 1, updated_at = %s
        WHERE job_id = %s AND lease_owner = %s
        """,
        (next_due_at(job, completed_at=now), error_code, now, job.job_id, worker_id),
    )
    if error_code is not None:
        before_hash = sha256(f"{job.job_id}:{job.attempt}:claimed".encode()).hexdigest()
        after_hash = sha256(f"{job.job_id}:{job.attempt + 1}:{error_code}".encode()).hexdigest()
        connection.execute(
            """
            INSERT INTO audit_entry (
              audit_id, actor, action, target_type, target_id, reason,
              before_hash, after_hash, occurred_at, metadata
            ) VALUES (%s, %s, 'scheduler.blocked', 'scheduler_job', %s, %s,
                      %s, %s, %s, %s::jsonb)
            ON CONFLICT (audit_id) DO NOTHING
            """,
            (
                f"AUD-{job.job_id}-{job.attempt + 1}",
                worker_id,
                job.job_id,
                error_code,
                before_hash,
                after_hash,
                now,
                json.dumps({"jobType": job.job_type, "targetId": job.target_id}),
            ),
        )


def run_once(
    connection: psycopg.Connection[dict[str, object]],
    *,
    worker_id: str,
    executor: DatabaseJobExecutor,
) -> int:
    now = datetime.now(UTC)
    with connection.transaction():
        deactivated = deactivate_unauthorized_jobs(
            cast(SchedulerConnection, connection),
            now=now,
        )
        for row in deactivated:
            job_id = str(row["job_id"])
            before_hash = sha256(f"{job_id}:active".encode()).hexdigest()
            after_hash = sha256(f"{job_id}:APPROVAL_NOT_EFFECTIVE".encode()).hexdigest()
            connection.execute(
                """
                INSERT INTO audit_entry (
                  audit_id, actor, action, target_type, target_id, reason,
                  before_hash, after_hash, occurred_at, metadata
                ) VALUES (%s, %s, 'scheduler.blocked', 'scheduler_job', %s, %s,
                          %s, %s, %s, %s::jsonb)
                ON CONFLICT (audit_id) DO NOTHING
                """,
                (
                    f"AUD-{job_id}-AUTH-{sha256(now.isoformat().encode()).hexdigest()[:12]}",
                    worker_id,
                    job_id,
                    "Effective approval or activation ended; schedule disabled",
                    before_hash,
                    after_hash,
                    now,
                    json.dumps(
                        {
                            "jobType": row["job_type"],
                            "targetId": row["target_id"],
                            "lastErrorCode": "APPROVAL_NOT_EFFECTIVE",
                        }
                    ),
                ),
            )
        jobs = claim_jobs(
            cast(SchedulerConnection, connection),
            worker_id=worker_id,
            limit=20,
            now=now,
            lease_seconds=60,
        )
    for job in jobs:
        error_code: str | None = None
        try:
            with connection.transaction():
                if scheduler_start_late(job, started_at=datetime.now(UTC)):
                    raise ExecutionBlocked("SCHEDULER_START_LATE")
                executor.execute(job)
                _finish_job(
                    connection,
                    job,
                    worker_id=worker_id,
                    now=datetime.now(UTC),
                    error_code=None,
                )
            _log(
                "job.completed",
                job_id=job.job_id,
                job_type=job.job_type,
            )
        except ExecutionBlocked as error:
            error_code = error.code
        except Exception:
            error_code = "JOB_EXECUTION_FAILED"
        if error_code is not None:
            with connection.transaction():
                _finish_job(
                    connection,
                    job,
                    worker_id=worker_id,
                    now=datetime.now(UTC),
                    error_code=error_code,
                )
            _log(
                "job.deferred" if error_code.endswith("REQUIRED") else "job.failed",
                job_id=job.job_id,
                job_type=job.job_type,
                reason=error_code,
            )
    return len(jobs)


def main() -> int:
    configuration = load_configuration()
    if not configuration.provider_access:
        _log(
            "worker.disabled",
            profile=configuration.profile,
            provider_access=False,
            evidence_mode=configuration.evidence_mode,
        )
        return 0
    groups, target_count = validate_runtime_contracts(configuration)
    targets = load_monitor_targets(configuration.monitor_targets_path)
    stopping = False

    def stop(_signum: int, _frame: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    worker_id = f"{socket.gethostname()}-{os.getpid()}"
    with psycopg.connect(configuration.database_url, row_factory=dict_row) as connection:
        connection.execute("SELECT 1")
        evidence_store: EvidenceStore
        if configuration.evidence_mode == "raw":
            s3_client = cast(
                S3Client,
                boto3_client(
                    "s3",
                    endpoint_url=configuration.object_store_endpoint,
                    aws_access_key_id=configuration.object_store_access_key,
                    aws_secret_access_key=configuration.object_store_secret_key,
                    region_name="us-east-1",
                ),
            )
            evidence_store = S3EvidenceStore(
                client=s3_client,
                bucket=cast(str, configuration.object_store_bucket),
            )
        else:
            evidence_store = DigestOnlyEvidenceStore()
        executor = DatabaseJobExecutor(
            connection,
            targets={target.monitor_id: target for target in targets},
            evidence_store=evidence_store,
            provider_access=configuration.provider_access,
            evidence_mode=configuration.evidence_mode,
        )
        configuration.ready_path.write_text("ready\n", encoding="utf-8")
        _log(
            "worker.ready",
            worker_id=worker_id,
            source_groups=groups,
            monitor_targets=target_count,
            profile=configuration.profile,
            provider_access=configuration.provider_access,
            evidence_mode=configuration.evidence_mode,
        )
        try:
            while not stopping:
                run_once(connection, worker_id=worker_id, executor=executor)
                time.sleep(configuration.poll_seconds)
        finally:
            configuration.ready_path.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
