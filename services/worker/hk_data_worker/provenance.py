from __future__ import annotations

import json
from datetime import datetime

from pydantic import Field

from .hashing import sha256_hex
from .models import ContractModel

type Scalar = str | int | float | bool | None


class FieldLineage(ContractModel):
    source_record_id: str
    json_pointer: str
    transform_version: str
    authority_class: str
    observed_at: datetime | None = None


class CanonicalEntity(ContractModel):
    canonical_entity_id: str
    entity_type: str
    entity_version: int = Field(ge=1)
    values: dict[str, dict[str, tuple[Scalar, ...]]]
    field_lineage: dict[str, tuple[FieldLineage, ...]]
    conflict_state: str
    source_record_ids: tuple[str, ...]


def entity_hash(entity: CanonicalEntity) -> str:
    encoded = json.dumps(
        entity.model_dump(mode="json"),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode()
    return sha256_hex(encoded)
