from __future__ import annotations

import json
from pathlib import Path

from scripts.catalog import (
    build_catalogue,
    load_access_index,
    load_records,
    validate_records,
    write_outputs,
)

FIXTURES = Path(__file__).parent / "fixtures"


def fixture_access_index(
    source_reference: str = "HKAPI-EXAMPLE",
    *,
    status: str = "fixture-tested",
) -> dict[str, object]:
    generated = load_access_index(Path("access/generated/recipes.json"))
    recipe = dict(generated["recipes"][0])
    recipe["sourceReference"] = source_reference
    recipe["status"] = status
    recipe["effectiveStatus"] = status
    if status == "manual-only":
        recipe.update(
            {
                "adapter": "none",
                "request": None,
                "response": None,
                "reason": "The source requires a manual resource choice.",
                "nextAction": "Choose and document the intended official resource.",
                "examples": {"curl": None, "python": None, "typescript": None},
            }
        )
    return {
        "schemaVersion": 1,
        "generatedAt": None,
        "recipes": [recipe],
        "coverage": {
            "totalOfficial": 1,
            "unclassified": 0,
            "byStatus": {status: 1},
        },
    }


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
    catalogue = build_catalogue([second, records[0]], fixture_access_index())

    access_index = fixture_access_index()
    write_outputs(catalogue, tmp_path, access_index)
    first = {path.name: path.read_bytes() for path in tmp_path.iterdir()}
    write_outputs(catalogue, tmp_path, access_index)
    second_write = {path.name: path.read_bytes() for path in tmp_path.iterdir()}

    assert second_write == first
    assert json.loads(first["catalogue.json"])["resources"][0]["id"] == "external:zeta"
    assert json.loads(first["counts.json"]) == {
        "accessExecutable": 1,
        "accessLiveVerified": 0,
        "byAccessStatus": {"fixture-tested": 1},
        "byTermsEvidenceState": {"not-reviewed": 2},
        "byTranslationStatus": {"reviewed": 2},
        "byType": {"external": 1, "official": 1},
        "total": 2,
    }
    assert set(first) == {
        "catalogue.json",
        "counts.json",
        "access-recipes.json",
        "external.json",
        "mcp.json",
        "official.json",
        "search-index.json",
        "stale.json",
    }


def test_official_integration_state_is_generated_from_recipe() -> None:
    records = load_records(FIXTURES / "valid")
    access_index = fixture_access_index()

    catalogue = build_catalogue(records, access_index)

    source = catalogue["resources"][0]
    recipe = access_index["recipes"][0]
    assert source["integrations"]["connector"] == "available"
    assert source["accessRecipe"]["recipeSha256"] == recipe["recipeSha256"]
    assert catalogue["counts"]["byAccessStatus"] == {"fixture-tested": 1}


def test_non_executable_recipe_does_not_claim_connector_availability() -> None:
    records = load_records(FIXTURES / "valid")

    catalogue = build_catalogue(records, fixture_access_index(status="manual-only"))

    source = catalogue["resources"][0]
    assert source["integrations"]["connector"] == "none"
    assert source["accessRecipe"]["request"] is None


def test_catalogue_join_rejects_missing_and_orphan_recipes() -> None:
    records = load_records(FIXTURES / "valid")
    missing = fixture_access_index()
    missing["recipes"] = []

    try:
        build_catalogue(records, missing)
    except ValueError as error:
        assert "missing access recipe: HKAPI-EXAMPLE" in str(error)
    else:
        raise AssertionError("missing recipe was accepted")

    orphan = fixture_access_index("HKAPI-ORPHAN")
    try:
        build_catalogue(records, orphan)
    except ValueError as error:
        assert "orphan access recipe: HKAPI-ORPHAN" in str(error)
    else:
        raise AssertionError("orphan recipe was accepted")
