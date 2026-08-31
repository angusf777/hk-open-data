from __future__ import annotations

import json
from abc import ABC, abstractmethod
from datetime import datetime
from urllib.parse import urlsplit

from pydantic import Field, model_validator

from ..hashing import sha256_hex
from ..models import Approval, ApprovedRequest, ContractModel, HttpsUrl, RawObjectRef


class ApprovalDenied(RuntimeError):
    pass


class QuarantineRequired(RuntimeError):
    pass


class ConnectorPagination(ContractModel):
    next_url_pointer: str = Field(pattern=r"^/")
    max_pages: int = Field(default=25, ge=1, le=100)


class ConnectorDefinition(ContractModel):
    connector_id: str
    source_group_id: str
    source_id: str
    endpoint: HttpsUrl
    method: str
    request_body: dict[str, object] | None = None
    project: str
    purpose: str
    timeout_ms: int = Field(gt=0, le=120_000)
    max_response_bytes: int = Field(gt=0, le=1_073_741_824)
    max_compressed_response_bytes: int = Field(default=10 * 1024 * 1024, gt=0, le=1_073_741_824)
    max_attempts: int = Field(default=3, ge=1, le=5)
    pagination: ConnectorPagination | None = None

    @model_validator(mode="after")
    def validate_request_shape(self) -> ConnectorDefinition:
        if self.method not in {"GET", "POST"}:
            raise ValueError("connector method must be GET or POST")
        if self.method == "POST" and self.request_body is None:
            raise ValueError("POST connector requires request_body")
        if self.method == "GET" and self.request_body is not None:
            raise ValueError("GET connector cannot define request_body")
        return self


class SourceRecordDraft(ContractModel):
    source_record_id: str
    source_id: str
    source_group_id: str
    raw_object_id: str
    raw_payload_hash: str
    record_key: str
    record_data: dict[str, object]
    record_hash: str
    language: str | None = None
    authority_class: str = "official"
    observed_at: datetime | None = None


class Connector(ABC):
    source_group_id: str

    def plan(
        self,
        definition: ConnectorDefinition,
        approval: Approval,
        *,
        at: datetime,
    ) -> tuple[ApprovedRequest, ...]:
        if definition.source_group_id != self.source_group_id:
            raise ValueError("connector definition belongs to a different source group")
        if approval.source_id != definition.source_id or not approval.authorizes(
            project=definition.project,
            purpose=definition.purpose,
            at=at,
        ):
            raise ApprovalDenied("connector run requires an effective approval")
        host = urlsplit(definition.endpoint).hostname
        if host is None:
            raise ValueError("connector endpoint has no host")
        body = (
            None
            if definition.request_body is None
            else json.dumps(
                definition.request_body, ensure_ascii=False, separators=(",", ":"), sort_keys=True
            ).encode()
        )
        headers = {} if body is None else {"content-type": "application/json"}
        return (
            ApprovedRequest.model_validate(
                {
                    "method": definition.method,
                    "url": definition.endpoint,
                    "allowed_hosts": [host],
                    "timeout_ms": definition.timeout_ms,
                    "max_response_bytes": definition.max_response_bytes,
                    "max_compressed_response_bytes": definition.max_compressed_response_bytes,
                    "max_attempts": definition.max_attempts,
                    "headers": headers,
                    "body": body,
                }
            ),
        )

    @abstractmethod
    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]: ...

    def parse_json(self, body: bytes, *, error_code: str) -> dict[str, object]:
        try:
            value = json.loads(body)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise QuarantineRequired(f"{error_code}: invalid JSON") from error
        if not isinstance(value, dict):
            raise QuarantineRequired(f"{error_code}: root must be an object")
        return value

    def records(
        self,
        definition: ConnectorDefinition,
        raw: RawObjectRef,
        items: list[object],
        *,
        error_code: str,
    ) -> tuple[SourceRecordDraft, ...]:
        records: list[SourceRecordDraft] = []
        for index, item in enumerate(items):
            data = item if isinstance(item, dict) else {"value": item}
            if not isinstance(data, dict):
                raise QuarantineRequired(f"{error_code}: record must be an object")
            serialized = json.dumps(
                data, ensure_ascii=False, separators=(",", ":"), sort_keys=True
            ).encode()
            candidate = next(
                (
                    str(data[key])
                    for key in ("id", "dataset_id", "BillId", "url", "period", "end_of_day")
                    if key in data and data[key] not in {None, ""}
                ),
                str(index),
            )
            records.append(
                SourceRecordDraft(
                    source_record_id=f"SR-{sha256_hex(f'{raw.raw_object_id}:{candidate}'.encode())}",
                    source_id=definition.source_id,
                    source_group_id=definition.source_group_id,
                    raw_object_id=raw.raw_object_id,
                    raw_payload_hash=raw.sha256,
                    record_key=candidate,
                    record_data={str(key): value for key, value in data.items()},
                    record_hash=sha256_hex(serialized),
                )
            )
        return tuple(records)


def require_list(value: object, *, error_code: str) -> list[object]:
    if not isinstance(value, list):
        raise QuarantineRequired(f"{error_code}: expected an array")
    return value
