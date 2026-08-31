from __future__ import annotations

import json
from pathlib import Path

from scripts.catalog import (
    build_catalogue,
    load_records,
    validate_records,
    write_outputs,
)

FIXTURES = Path(__file__).parent / "fixtures"


def test_catalogue_loader_ignores_schema_and_vocabulary_yaml() -> None:
    paths = {record["_path"] for record in load_records(Path("catalog"))}

    assert paths
    assert all("/schemas/" not in path for path in paths)
    assert all("/vocabularies/" not in path for path in paths)


def test_valid_record_passes_schema_validation() -> None:
    records = load_records(FIXTURES / "valid")

    assert validate_records(records) == []


def test_published_record_missing_traditional_chinese_fields_fails() -> None:
    records = load_records(FIXTURES / "invalid")

    errors = validate_records(records)

    assert any("name.zh-Hant" in error for error in errors)
    assert any("summary.zh-Hant" in error for error in errors)
    assert any("provider.name.zh-Hant" in error for error in errors)


def test_duplicate_id_and_source_reference_fail() -> None:
    records = load_records(FIXTURES / "valid")
    duplicate = {**records[0], "_path": "second.yml"}

    errors = validate_records([records[0], duplicate])

    assert any("duplicate id: official:example" in error for error in errors)
    assert any(
        "duplicate sourceReference within official: HKAPI-EXAMPLE" in error for error in errors
    )


def test_id_prefix_must_match_resource_type() -> None:
    records = load_records(FIXTURES / "valid")
    records[0]["id"] = "external:example"

    assert any("id prefix must match type official" in error for error in validate_records(records))


def test_output_is_sorted_and_reproducible(tmp_path: Path) -> None:
    records = load_records(FIXTURES / "valid")
    second = {
        **records[0],
        "_path": "external-zeta.yml",
        "id": "external:zeta",
        "sourceReference": "EXT-ZETA",
        "type": "external",
    }
    catalogue = build_catalogue([second, records[0]])

    write_outputs(catalogue, tmp_path)
    first = {path.name: path.read_bytes() for path in tmp_path.iterdir()}
    write_outputs(catalogue, tmp_path)
    second_write = {path.name: path.read_bytes() for path in tmp_path.iterdir()}

    assert second_write == first
    assert json.loads(first["catalogue.json"])["resources"][0]["id"] == "external:zeta"
    assert json.loads(first["counts.json"]) == {
        "byTermsEvidenceState": {"not-reviewed": 2},
        "byTranslationStatus": {"reviewed": 2},
        "byType": {"external": 1, "official": 1},
        "total": 2,
    }
    assert set(first) == {
        "catalogue.json",
        "counts.json",
        "external.json",
        "mcp.json",
        "official.json",
        "search-index.json",
        "stale.json",
    }
