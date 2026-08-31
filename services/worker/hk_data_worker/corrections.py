from __future__ import annotations

from datetime import datetime

from .models import ContractModel
from .provenance import CanonicalEntity, FieldLineage, Scalar, entity_hash


class Correction(ContractModel):
    field: str
    language: str
    value: Scalar
    evidence_source_record_id: str
    reason: str
    actor: str
    occurred_at: datetime


class CorrectionAudit(ContractModel):
    canonical_entity_id: str
    from_version: int
    to_version: int
    before_hash: str
    after_hash: str
    evidence_source_record_id: str
    reason: str
    actor: str
    occurred_at: datetime


def apply_correction(
    entity: CanonicalEntity, correction: Correction
) -> tuple[CanonicalEntity, CorrectionAudit]:
    if correction.field not in entity.values:
        raise ValueError(f"unknown canonical field: {correction.field}")
    values = {
        field: {language: tuple(items) for language, items in languages.items()}
        for field, languages in entity.values.items()
    }
    values[correction.field][correction.language] = (correction.value,)
    lineage = {field: tuple(items) for field, items in entity.field_lineage.items()}
    lineage_key = f"{correction.field}.{correction.language}"
    lineage[lineage_key] = (
        *lineage.get(lineage_key, ()),
        FieldLineage(
            source_record_id=correction.evidence_source_record_id,
            json_pointer=f"/corrections/{correction.field}/{correction.language}",
            transform_version="correction-v1",
            authority_class="reviewed_correction",
            observed_at=correction.occurred_at,
        ),
    )
    source_record_ids = tuple(
        dict.fromkeys((*entity.source_record_ids, correction.evidence_source_record_id))
    )
    corrected = entity.model_copy(
        update={
            "entity_version": entity.entity_version + 1,
            "values": values,
            "field_lineage": lineage,
            "source_record_ids": source_record_ids,
        }
    )
    audit = CorrectionAudit(
        canonical_entity_id=entity.canonical_entity_id,
        from_version=entity.entity_version,
        to_version=corrected.entity_version,
        before_hash=entity_hash(entity),
        after_hash=entity_hash(corrected),
        evidence_source_record_id=correction.evidence_source_record_id,
        reason=correction.reason,
        actor=correction.actor,
        occurred_at=correction.occurred_at,
    )
    return corrected, audit
