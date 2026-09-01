from __future__ import annotations

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

CONTRACT_VERSION = "2026-08-28.v1"
HttpsUrl = Annotated[str, Field(pattern=r"^https://")]
Sha256 = Annotated[str, Field(pattern=r"^[a-f0-9]{64}$")]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class SourceGroup(ContractModel):
    source_group_id: Annotated[str, Field(pattern=r"^P01-SG-(0[1-9]|10)$")]
    source_ids: tuple[str, ...]
    name: str
    provider: str
    protocols: tuple[str, ...]
    first_connector_scope: tuple[str, ...]
    nominal_cadence: str
    raw_retention_class: str
    activation_gate: tuple[str, ...]
    operator_hint: str
    status: Literal["specified_pending_approval", "approved", "retired"]

    @field_validator("source_ids", "protocols", "first_connector_scope", "activation_gate")
    @classmethod
    def require_non_empty_tuple(cls, value: tuple[str, ...]) -> tuple[str, ...]:
        if not value or any(not item for item in value):
            raise ValueError("semicolon-delimited values cannot be empty")
        return value


class MonitorTarget(ContractModel):
    monitor_id: Annotated[str, Field(pattern=r"^P14-M[0-9]{3}$")]
    source_id: Annotated[str, Field(pattern=r"^(HKAPI|EXT)-[0-9]{3}$")]
    source_group_id: Annotated[str, Field(pattern=r"^(P01-SG-(0[1-9]|10)|P14-ONLY-01)$")]
    provider: str
    name: str
    method: Literal["GET", "POST"]
    request_template: HttpsUrl
    request_body_json: dict[str, object] | None
    cadence_seconds: Annotated[int, Field(gt=0)]
    timeout_ms: Annotated[int, Field(gt=0, le=120_000)]
    freshness_rule: str
    required_checks: tuple[str, ...]
    public_visibility: Literal["public", "private", "pending_review", "private_until_review"]
    activation_status: Literal["specified_pending_approval", "approved", "suspended", "retired"]
    documentation_url: HttpsUrl
    notes: str

    @field_validator("request_body_json")
    @classmethod
    def require_post_body(
        cls, value: dict[str, object] | None, info: object
    ) -> dict[str, object] | None:
        del info
        return value


class Approval(ContractModel):
    approval_id: str
    source_id: str
    decision: Literal["approved", "restricted", "rejected", "revoked"]
    projects: tuple[str, ...]
    purposes: tuple[str, ...]
    storage: str
    retention: str
    redistribution: str
    attribution: str
    evidence_urls: tuple[HttpsUrl, ...]
    decided_at: datetime
    expires_at: datetime
    actor: str

    def authorizes(self, *, project: str, purpose: str, at: datetime) -> bool:
        return (
            self.decision in {"approved", "restricted"}
            and project in self.projects
            and purpose in self.purposes
            and self.decided_at <= at < self.expires_at
        )


class ApprovedRequest(ContractModel):
    method: Literal["GET", "POST", "HEAD"]
    url: HttpsUrl
    allowed_hosts: tuple[str, ...]
    timeout_ms: Annotated[int, Field(gt=0, le=60_000)] = 30_000
    max_response_bytes: Annotated[int, Field(gt=0, le=25 * 1024 * 1024)] = 10 * 1024 * 1024
    max_compressed_response_bytes: Annotated[int, Field(gt=0, le=25 * 1024 * 1024)] = (
        10 * 1024 * 1024
    )
    max_attempts: Annotated[int, Field(ge=1, le=3)] = 1
    retry_status_codes: tuple[Annotated[int, Field(ge=100, le=599)], ...] = (
        408,
        429,
        500,
        502,
        503,
        504,
    )
    allowed_media_types: tuple[str, ...] = ()
    headers: dict[str, str] = Field(default_factory=dict)
    body: bytes | None = None


class FetchResult(ContractModel):
    status_code: int
    headers: dict[str, str]
    body: bytes
    final_url: HttpsUrl
    elapsed_ms: Annotated[int, Field(ge=0)]


class RawObjectRef(ContractModel):
    raw_object_id: str
    object_uri: str
    sha256: Sha256
    media_type: str
    size_bytes: Annotated[int, Field(ge=0)]
    retention_class: str


class ConnectorRun(ContractModel):
    connector_run_id: str
    connector_id: str
    source_id: str
    code_version: str
    status: Literal["planned", "running", "success", "quarantined", "failed"]
    started_at: datetime
    finished_at: datetime | None = None
    request_fingerprint: Sha256
    raw_object_ids: tuple[str, ...] = ()
    error_code: str | None = None


type MonitorCheckName = Literal[
    "availability",
    "media",
    "contract",
    "freshness",
    "schema",
    "semantic",
    "bilingual",
    "geometry",
    "redirect",
    "hash",
]


class CheckResult(ContractModel):
    check: MonitorCheckName
    outcome: Literal["pass", "degraded", "fail", "not_applicable", "unknown"]
    code: str
    message: str | None = None


class MonitorObservation(ContractModel):
    observation_id: str
    monitor_id: str
    started_at: datetime
    finished_at: datetime
    outcome: Literal["pass", "degraded", "fail", "maintenance", "suppressed", "unknown"]
    check_results: tuple[CheckResult, ...]
    latency_ms: Annotated[int, Field(ge=0)]
    evidence_hash: Sha256
    baseline_version: str
    seeded_failure: bool = False
    http_status: int | None = None
    provider_timestamp: datetime | None = None
    freshness_age_seconds: int | None = None
    content_hash: Sha256 | None = None
    schema_fingerprint: Sha256 | None = None
    connector_run_id: str | None = None
    correlation_id: str | None = None


class Incident(ContractModel):
    incident_id: str
    source_id: str
    status: Literal["candidate", "open", "acknowledged", "monitoring", "resolved", "suppressed"]
    severity: Literal["minor", "moderate", "major", "critical"]
    category: str
    monitor_ids: tuple[str, ...]
    observation_ids: tuple[str, ...]
    opened_at: datetime
    last_observed_at: datetime
    public_state: Literal["private", "review_required", "published", "corrected", "withdrawn"]
    audit_version: Annotated[int, Field(ge=1)]
    acknowledged_at: datetime | None = None
    acknowledged_by: str | None = None
    resolved_at: datetime | None = None
    resolved_by: str | None = None
    suppression_reason: str | None = None
    suppression_expires_at: datetime | None = None
    cause: str | None = None
