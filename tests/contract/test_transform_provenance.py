from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from hk_data_worker.connectors.base import SourceRecordDraft
from hk_data_worker.corrections import Correction, apply_correction
from hk_data_worker.hashing import sha256_hex
from hk_data_worker.transform import TransformDefinition, event_from_entity, normalize
from jsonschema import Draft202012Validator

NOW = datetime(2026, 8, 28, 10, tzinfo=UTC)


def record(
    record_id: str, *, language: str, name: str, authority: str = "official"
) -> SourceRecordDraft:
    data: dict[str, object] = {"id": "place-1", "name": name, "language": language}
    return SourceRecordDraft(
        source_record_id=record_id,
        source_id="HKAPI-013",
        source_group_id="P01-SG-03",
        raw_object_id=f"RAW-{record_id}",
        raw_payload_hash="a" * 64,
        record_key="place-1",
        record_data=data,
        record_hash=sha256_hex(json.dumps(data, sort_keys=True).encode()),
        language=language,
        authority_class=authority,
        observed_at=NOW,
    )


DEFINITION = TransformDefinition(
    transform_version="place-v1",
    entity_type="place",
    identity_pointer="/id",
    language_pointer="/language",
    field_mappings={"name": "/name"},
)


def test_preserves_bilingual_values_and_exact_field_lineage() -> None:
    entity = normalize(
        [
            record("SR-EN000001", language="en", name="Central"),
            record("SR-ZH000001", language="zh_Hant", name="中環"),
        ],
        DEFINITION,
    )[0]

    assert entity.values["name"] == {"en": ("Central",), "zh_Hant": ("中環",)}
    assert entity.field_lineage["name.en"][0].source_record_id == "SR-EN000001"
    assert entity.field_lineage["name.zh_Hant"][0].json_pointer == "/name"
    assert entity.conflict_state == "none"


def test_retains_conflicting_values_with_authority_and_recency() -> None:
    entity = normalize(
        [
            record("SR-OFFICIAL", language="en", name="Central", authority="official"),
            record("SR-DERIVED1", language="en", name="Central District", authority="derived"),
        ],
        DEFINITION,
    )[0]

    assert entity.values["name"]["en"] == ("Central", "Central District")
    assert entity.conflict_state == "conflict"
    assert [item.authority_class for item in entity.field_lineage["name.en"]] == [
        "official",
        "derived",
    ]


def test_correction_is_append_only_and_adds_evidence_lineage() -> None:
    original = normalize([record("SR-EN000001", language="en", name="Central")], DEFINITION)[0]
    corrected, audit = apply_correction(
        original,
        Correction(
            field="name",
            language="en",
            value="Central District",
            evidence_source_record_id="SR-CORR0001",
            reason="Provider correction notice",
            actor="reviewer@example.gov.hk",
            occurred_at=NOW,
        ),
    )

    assert original.entity_version == 1
    assert original.values["name"]["en"] == ("Central",)
    assert corrected.entity_version == 2
    assert corrected.values["name"]["en"] == ("Central District",)
    assert corrected.field_lineage["name.en"][-1].source_record_id == "SR-CORR0001"
    assert audit.before_hash != audit.after_hash


def test_emitted_event_validates_against_normative_schema() -> None:
    entity = normalize([record("SR-EN000001", language="en", name="Central")], DEFINITION)[0]
    event = event_from_entity(
        entity,
        event_id="EV-PLACE0001",
        title={"en": "Place changed", "zh_Hant": "地點已變更"},
        summary={"en": "Name changed", "zh_Hant": "名稱已變更"},
        observed_at=NOW,
    )
    schema_path = (
        Path(__file__).resolve().parents[2]
        / "packages"
        / "schemas"
        / "contracts"
        / "canonical_event.schema.json"
    )
    schema = json.loads(schema_path.read_text(encoding="utf-8"))

    Draft202012Validator(schema).validate(event)
