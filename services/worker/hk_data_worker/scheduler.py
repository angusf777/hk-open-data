from __future__ import annotations

import threading
from collections.abc import Mapping
from datetime import datetime, timedelta
from hashlib import sha256
from typing import Literal, Protocol

from pydantic import Field

from .models import ContractModel


class SchedulerJob(ContractModel):
    job_id: str
    job_type: Literal["connector", "monitor"]
    target_id: str
    due_at: datetime
    cadence_seconds: int = Field(gt=0)
    attempt: int = Field(ge=0)
    lease_owner: str | None = None
    lease_expires_at: datetime | None = None


class InMemoryJobStore:
    def __init__(self, jobs: list[SchedulerJob]) -> None:
        self._jobs = {job.job_id: job for job in jobs}
        self._lock = threading.Lock()

    def claim(
        self, *, worker_id: str, limit: int, now: datetime, lease_seconds: int
    ) -> list[SchedulerJob]:
        if limit < 1 or lease_seconds < 1:
            raise ValueError("limit and lease_seconds must be positive")
        with self._lock:
            due = sorted(
                (
                    job
                    for job in self._jobs.values()
                    if job.due_at <= now
                    and (job.lease_expires_at is None or job.lease_expires_at <= now)
                ),
                key=lambda job: (job.due_at, job.job_id),
            )[:limit]
            claimed = [
                job.model_copy(
                    update={
                        "lease_owner": worker_id,
                        "lease_expires_at": now + timedelta(seconds=lease_seconds),
                    }
                )
                for job in due
            ]
            for job in claimed:
                self._jobs[job.job_id] = job
            return claimed


class SchedulerCursor(Protocol):
    def fetchall(self) -> list[Mapping[str, object]]: ...


class SchedulerConnection(Protocol):
    def execute(self, sql: str, parameters: tuple[object, ...]) -> SchedulerCursor: ...


def deactivate_unauthorized_jobs(
    connection: SchedulerConnection, *, now: datetime
) -> list[Mapping[str, object]]:
    """Disable schedules whose latest approval or activation is no longer effective."""
    cursor = connection.execute(
        """
        WITH unauthorized AS (
          SELECT job.job_id
          FROM scheduler_job AS job
          WHERE job.active = true AND (
            (job.job_type = 'connector' AND NOT EXISTS (
              SELECT 1
              FROM connector_definition AS connector
              JOIN LATERAL (
                SELECT approval.decision, approval.projects, approval.purposes,
                       approval.decided_at, approval.expires_at
                FROM source_approval AS approval
                WHERE approval.source_id = connector.configuration_schema ->> 'source_id'
                ORDER BY approval.decided_at DESC, approval.approval_id DESC
                LIMIT 1
              ) AS latest ON true
              WHERE connector.connector_id = job.target_id
                AND connector.enabled = true
                AND latest.decision IN ('approved', 'restricted')
                AND latest.decided_at <= %s AND latest.expires_at > %s
                AND connector.configuration_schema ->> 'project' = ANY(latest.projects)
                AND connector.configuration_schema ->> 'purpose' = ANY(latest.purposes)
            )) OR
            (job.job_type = 'monitor' AND NOT EXISTS (
              SELECT 1
              FROM monitor_target AS target
              JOIN LATERAL (
                SELECT approval.decision, approval.projects, approval.purposes,
                       approval.decided_at, approval.expires_at
                FROM source_approval AS approval
                WHERE approval.source_id = target.source_id
                ORDER BY approval.decided_at DESC, approval.approval_id DESC
                LIMIT 1
              ) AS latest ON true
              WHERE target.monitor_id = job.target_id
                AND target.activation_status = 'approved'
                AND latest.decision IN ('approved', 'restricted')
                AND latest.decided_at <= %s AND latest.expires_at > %s
                AND 'P14' = ANY(latest.projects)
                AND 'quality-monitoring' = ANY(latest.purposes)
            ))
          )
        )
        UPDATE scheduler_job AS job
        SET active = false, lease_owner = NULL, lease_expires_at = NULL,
            last_error_code = 'APPROVAL_NOT_EFFECTIVE', updated_at = %s
        FROM unauthorized
        WHERE job.job_id = unauthorized.job_id
        RETURNING job.job_id, job.job_type, job.target_id, job.attempt
        """,
        (now, now, now, now, now),
    )
    return cursor.fetchall()


def claim_jobs(
    connection: SchedulerConnection,
    *,
    worker_id: str,
    limit: int,
    now: datetime,
    lease_seconds: int,
) -> list[SchedulerJob]:
    if limit < 1 or lease_seconds < 1:
        raise ValueError("limit and lease_seconds must be positive")
    cursor = connection.execute(
        """
        WITH due AS (
          SELECT job_id FROM scheduler_job
          WHERE active = true AND due_at <= %s
            AND (lease_expires_at IS NULL OR lease_expires_at <= %s)
          ORDER BY due_at, job_id
          LIMIT %s
          FOR UPDATE SKIP LOCKED
        )
        UPDATE scheduler_job AS job
        SET lease_owner = %s, lease_expires_at = %s, updated_at = %s
        FROM due WHERE job.job_id = due.job_id
        RETURNING job.job_id, job.job_type, job.target_id, job.due_at,
                  job.cadence_seconds, job.attempt, job.lease_owner, job.lease_expires_at
        """,
        (
            now,
            now,
            limit,
            worker_id,
            now + timedelta(seconds=lease_seconds),
            now,
        ),
    )
    return [SchedulerJob.model_validate(dict(row)) for row in cursor.fetchall()]


def next_due_at(job: SchedulerJob, *, completed_at: datetime) -> datetime:
    jitter_range = max(1, min(30, job.cadence_seconds // 20))
    jitter = int.from_bytes(sha256(job.job_id.encode()).digest()[:2], "big") % jitter_range
    return completed_at + timedelta(seconds=job.cadence_seconds + jitter)


def reusable_connector_run(
    *, status: str, finished_at: datetime, now: datetime, cadence_seconds: int
) -> bool:
    age = (now - finished_at).total_seconds()
    return status == "success" and 0 <= age <= cadence_seconds


def scheduler_start_late(job: SchedulerJob, *, started_at: datetime) -> bool:
    allowed_seconds = min(300, max(30, job.cadence_seconds // 10))
    return (started_at - job.due_at).total_seconds() > allowed_seconds
