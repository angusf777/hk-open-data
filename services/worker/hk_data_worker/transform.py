from __future__ import annotations

from collections import defaultdict
from datetime import datetime

from pydantic import Field

from .connectors.base import SourceRecordDraft
from .hashing import sha256_hex
from .models import ContractModel
from .provenance import CanonicalEntity, FieldLineage, Scalar


class TransformDefinition(ContractModel):
    transform_version: str
    entity_type: str
    identity_pointer: str
    language_pointer: str
    field_mappings: dict[str, str] = Field(min_length=1)


def _pointer(document: dict[str, object], pointer: str) -> object:
    if not pointer.startswith("/"):
        raise ValueError(f"JSON pointer must start with '/': {pointer}")
    value: object = document
    for encoded_part in pointer.removeprefix("/").split("/"):
        part = encoded_part.replace("~1", "/").replace("~0", "~")
        if not isinstance(value, dict) or part not in value:
            raise ValueError(f"required JSON pointer is absent: {pointer}")
        value = value[part]
    return value


def _scalar(value: object, pointer: str) -> Scalar:
    if value is None or isinstance(value, str | int | float | bool):
        return value
    raise ValueError(f"mapped JSON pointer must select a scalar: {pointer}")


def normalize(
    records: list[SourceRecordDraft] | tuple[SourceRecordDraft, ...],
    definition: TransformDefinition,
) -> tuple[CanonicalEntity, ...]:
    grouped: dict[str, list[SourceRecordDraft]] = defaultdict(list)
    for record in records:
        identity = _scalar(
            _pointer(record.record_data, definition.identity_pointer),
            definition.identity_pointer,
        )
        if identity in {None, ""}:
            raise ValueError("canonical identity cannot be empty")
        grouped[str(identity)].append(record)

    entities: list[CanonicalEntity] = []
    for identity, entity_records in sorted(grouped.items()):
        values: dict[str, dict[str, list[Scalar]]] = defaultdict(lambda: defaultdict(list))
        lineage: dict[str, list[FieldLineage]] = defaultdict(list)
        for record in entity_records:
            language_value = record.language
            if language_value is None:
                language_value = str(
                    _scalar(
                        _pointer(record.record_data, definition.language_pointer),
                        definition.language_pointer,
                    )
                )
            for field, pointer in definition.field_mappings.items():
                field_value = _scalar(_pointer(record.record_data, pointer), pointer)
                if field_value not in values[field][language_value]:
                    values[field][language_value].append(field_value)
                lineage[f"{field}.{language_value}"].append(
                    FieldLineage(
                        source_record_id=record.source_record_id,
                        json_pointer=pointer,
                        transform_version=definition.transform_version,
                        authority_class=record.authority_class,
                        observed_at=record.observed_at,
                    )
                )
        immutable_values = {
            field: {language: tuple(items) for language, items in languages.items()}
            for field, languages in values.items()
        }
        conflict = any(
            len(items) > 1
            for languages in immutable_values.values()
            for items in languages.values()
        )
        entities.append(
            CanonicalEntity(
                canonical_entity_id=(
                    f"ENT-{definition.entity_type}-{sha256_hex(identity.encode())[:16]}"
                ),
                entity_type=definition.entity_type,
                entity_version=1,
                values=immutable_values,
                field_lineage={field: tuple(items) for field, items in lineage.items()},
                conflict_state="conflict" if conflict else "none",
                source_record_ids=tuple(
                    dict.fromkeys(record.source_record_id for record in entity_records)
                ),
            )
        )
    return tuple(entities)


def event_from_entity(
    entity: CanonicalEntity,
    *,
    event_id: str,
    title: dict[str, str | None],
    summary: dict[str, str | None],
    observed_at: datetime,
) -> dict[str, object]:
    return {
        "event_id": event_id,
        "event_type": "source.changed",
        "status": "active",
        "severity": "informational",
        "title": title,
        "summary": summary,
        "source_records": list(entity.source_record_ids),
        "observed_at": observed_at.isoformat().replace("+00:00", "Z"),
        "quality_flags": [] if entity.conflict_state == "none" else ["value_conflict"],
        "schema_version": "1.0.0",
        "affected_entities": [entity.canonical_entity_id],
    }
