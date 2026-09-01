from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from hk_data_worker.access.generation import (
    effective_status,
    generate_access_artifacts,
    recipe_sha256,
    validate_access_registry,
)
from hk_data_worker.access.models import AccessStatus, VerificationEvidence
from hk_data_worker.access.registry import load_recipes

FIXTURES = Path(__file__).parent / "fixtures"
NOW = datetime(2026, 9, 1, 12, tzinfo=UTC)


def test_complete_registry_reports_duplicate_missing_and_orphan_references() -> None:
    recipe = load_recipes(FIXTURES / "valid")[0]
    orphan = recipe.model_copy(update={"source_reference": "HKAPI-003"})

    findings = validate_access_registry(
        catalogue_references=("HKAPI-001", "HKAPI-002"),
        recipes=(recipe, orphan, orphan),
        evidence=(),
    )

    assert findings == [
        "duplicate recipe: HKAPI-003",
        "missing recipe: HKAPI-002",
        "orphan recipe: HKAPI-003",
    ]


def test_recipe_hash_uses_canonical_public_contract_bytes() -> None:
    recipe = load_recipes(FIXTURES / "valid")[0]

    assert recipe_sha256(recipe) == (
        "52e226da48a3821920df1260a017e260a3e2c22a97aea56c057e5e62af86e489"
    )


def test_generation_is_byte_for_byte_reproducible(tmp_path: Path) -> None:
    recipe = load_recipes(FIXTURES / "valid")[0]

    generate_access_artifacts(
        catalogue_references=("HKAPI-001",),
        recipes=(recipe,),
        evidence=(),
        output=tmp_path,
    )
    first = {
        str(path.relative_to(tmp_path)): path.read_bytes()
        for path in sorted(tmp_path.rglob("*"))
        if path.is_file()
    }
    generate_access_artifacts(
        catalogue_references=("HKAPI-001",),
        recipes=(recipe,),
        evidence=(),
        output=tmp_path,
    )
    second = {
        str(path.relative_to(tmp_path)): path.read_bytes()
        for path in sorted(tmp_path.rglob("*"))
        if path.is_file()
    }

    assert second == first
    assert set(first) == {
        "coverage.json",
        "examples/curl/hkapi-001.sh",
        "examples/python/hkapi-001.py",
        "examples/typescript/hkapi-001.ts",
        "recipes.json",
    }
    index = json.loads(first["recipes.json"])
    assert index["generatedAt"] is None
    assert index["recipes"][0]["recipeSha256"] == recipe_sha256(recipe)
    assert index["recipes"][0]["effectiveStatus"] == "fixture-tested"
    assert index["coverage"] == {
        "byStatus": {
            "blocked": 0,
            "credential-required": 0,
            "fixture-tested": 1,
            "live-verified": 0,
            "manual-only": 0,
            "unavailable": 0,
        },
        "totalOfficial": 1,
        "unclassified": 0,
    }


def test_non_executable_recipe_generates_null_examples(tmp_path: Path) -> None:
    fixture = load_recipes(FIXTURES / "valid")[0]
    recipe = fixture.model_validate(
        {
            **fixture.model_dump(mode="json", by_alias=True),
            "adapter": "none",
            "status": "manual-only",
            "request": None,
            "response": None,
            "reason": "The provider publishes an interactive search form only.",
            "nextAction": "Open the official documentation and follow its manual workflow.",
        }
    )

    index = generate_access_artifacts(
        catalogue_references=("HKAPI-001",),
        recipes=(recipe,),
        evidence=(),
        output=tmp_path,
    )

    assert index["recipes"][0]["examples"] == {
        "curl": None,
        "python": None,
        "typescript": None,
    }
    assert not (tmp_path / "examples").exists()


def test_live_status_requires_successful_unexpired_matching_evidence() -> None:
    recipe = load_recipes(FIXTURES / "valid")[0].model_copy(
        update={"status": AccessStatus.LIVE_VERIFIED}
    )
    current = VerificationEvidence(
        schema_version=1,
        source_reference="HKAPI-001",
        recipe_version="1.0.0",
        recipe_sha256=recipe_sha256(recipe),
        checked_at=NOW - timedelta(hours=1),
        valid_until=NOW + timedelta(days=1),
        outcome="success",
        error_code=None,
        final_host="data.gov.hk",
        http_status=200,
        elapsed_ms=120,
        media_type="application/json",
        response_bytes=52,
        response_sha256="a" * 64,
        schema_fingerprint="b" * 64,
        parsed_record_count=2,
        limitations=(),
        tool_version="0.1.0",
    )

    assert effective_status(recipe, current, NOW) is AccessStatus.LIVE_VERIFIED
    assert effective_status(
        recipe,
        current.model_copy(update={"valid_until": NOW - timedelta(seconds=1)}),
        NOW,
    ) is AccessStatus.FIXTURE_TESTED
    assert effective_status(
        recipe,
        current.model_copy(update={"recipe_sha256": "0" * 64}),
        NOW,
    ) is AccessStatus.FIXTURE_TESTED


def test_registry_reports_live_recipe_without_current_matching_evidence() -> None:
    recipe = load_recipes(FIXTURES / "valid")[0].model_copy(
        update={"status": AccessStatus.LIVE_VERIFIED}
    )

    findings = validate_access_registry(
        catalogue_references=("HKAPI-001",),
        recipes=(recipe,),
        evidence=(),
        now=NOW,
    )

    assert findings == ["live-verified recipe lacks current matching evidence: HKAPI-001"]
