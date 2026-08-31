from __future__ import annotations

from datetime import datetime

from pydantic import Field

from ..models import ContractModel, HttpsUrl


class MonitorBaseline(ContractModel):
    baseline_version: str
    schema_shape: dict[str, str]
    required_pointers: tuple[str, ...] = ()
    identifier_pointer: str | None = None
    identifier_pattern: str | None = None
    provider_timestamp_pointer: str | None = None
    max_age_seconds: int | None = Field(default=None, gt=0)
    event_list_pointer: str | None = None
    bilingual_primary_pointer: str | None = None
    bilingual_peer_pointer: str | None = None
    geometry_pointer: str | None = None
    cursor_current_pointer: str | None = None
    cursor_next_pointer: str | None = None
    maintenance_pointer: str | None = None
    operator_identity: str = "fixture-operator"
    activated_at: datetime | None = None
    evidence_observation_ids: tuple[str, ...] = ()


class MaintenanceWindow(ContractModel):
    owner: str = Field(min_length=1)
    reason: str = Field(min_length=1)
    evidence_url: HttpsUrl
    starts_at: datetime
    expires_at: datetime

    def active(self, at: datetime) -> bool:
        return self.starts_at <= at < self.expires_at


class BaselineChange(ContractModel):
    prior_version: str
    new_version: str
    added_pointers: tuple[str, ...]
    removed_pointers: tuple[str, ...]
    type_changed_pointers: tuple[str, ...]
    operator_identity: str
    activated_at: datetime
    evidence_observation_ids: tuple[str, ...]


def _type_name(value: object) -> str:
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, str):
        return "string"
    if isinstance(value, int | float):
        return "number"
    if isinstance(value, list):
        return "array"
    if isinstance(value, dict):
        return "object"
    return "unknown"


def schema_shape(document: object) -> dict[str, str]:
    result: dict[str, str] = {}

    def visit(value: object, pointer: str) -> None:
        result[pointer or "/"] = _type_name(value)
        if isinstance(value, dict):
            for key, child in sorted(value.items()):
                encoded = str(key).replace("~", "~0").replace("/", "~1")
                visit(child, f"{pointer}/{encoded}")
        elif isinstance(value, list):
            for child in value[:1]:
                visit(child, f"{pointer}/*")

    visit(document, "")
    return result


def activate_baseline(
    previous: MonitorBaseline,
    document: object,
    *,
    evidence_observation_ids: tuple[str, ...],
    operator_identity: str,
    activated_at: datetime,
) -> tuple[MonitorBaseline, BaselineChange]:
    if not evidence_observation_ids:
        raise ValueError("baseline activation requires observation evidence")
    current_shape = schema_shape(document)
    try:
        next_version = str(int(previous.baseline_version) + 1)
    except ValueError as error:
        raise ValueError("baseline_version must be numeric") from error
    added = tuple(sorted(set(current_shape) - set(previous.schema_shape)))
    removed = tuple(sorted(set(previous.schema_shape) - set(current_shape)))
    changed = tuple(
        sorted(
            pointer
            for pointer in set(previous.schema_shape) & set(current_shape)
            if previous.schema_shape[pointer] != current_shape[pointer]
        )
    )
    updated = previous.model_copy(
        update={
            "baseline_version": next_version,
            "schema_shape": current_shape,
            "operator_identity": operator_identity,
            "activated_at": activated_at,
            "evidence_observation_ids": evidence_observation_ids,
        }
    )
    return updated, BaselineChange(
        prior_version=previous.baseline_version,
        new_version=next_version,
        added_pointers=added,
        removed_pointers=removed,
        type_changed_pointers=changed,
        operator_identity=operator_identity,
        activated_at=activated_at,
        evidence_observation_ids=evidence_observation_ids,
    )
