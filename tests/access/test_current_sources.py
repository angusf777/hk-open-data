from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path

from hk_data_worker.access.generation import recipe_sha256
from hk_data_worker.access.registry import load_recipes
from hk_data_worker.adapters import ADAPTERS
from hk_data_worker.models import FetchResult

ROOT = Path(__file__).parents[2]
FIXTURES = ROOT / "tests" / "fixtures" / "access" / "current-sources"
CURRENT_REFERENCES = {
    "HKAPI-001",
    "HKAPI-002",
    "HKAPI-003",
    "HKAPI-004",
    "HKAPI-005",
    "HKAPI-006",
    "HKAPI-007",
    "HKAPI-008",
    "HKAPI-009",
    "HKAPI-010",
    "HKAPI-012",
    "HKAPI-013",
    "HKAPI-014",
    "HKAPI-015",
    "HKAPI-016",
    "HKAPI-017",
    "HKAPI-018",
    "HKAPI-019",
    "HKAPI-020",
    "HKAPI-021",
    "HKAPI-023",
    "HKAPI-034",
}


def test_current_runtime_sources_have_source_specific_recipe_fixtures() -> None:
    manifest = json.loads((FIXTURES / "manifest.json").read_text(encoding="utf-8"))
    assert set(manifest) == CURRENT_REFERENCES
    recipes = {
        recipe.source_reference: recipe
        for recipe in load_recipes(ROOT / "access" / "recipes" / "official")
        if recipe.source_reference in CURRENT_REFERENCES
    }
    assert set(recipes) == CURRENT_REFERENCES

    for reference, fixture in manifest.items():
        recipe = recipes[reference]
        if recipe.request is None:
            assert recipe.reason and recipe.next_action
            assert fixture is None
            continue
        assert isinstance(fixture, dict)
        fixture_bytes = (FIXTURES / fixture["file"]).read_bytes()
        assert fixture["provenance"] == "synthetic-authored"
        assert fixture["documentationUrl"] == recipe.documentation_url
        assert fixture["recipeSha256"] == recipe_sha256(recipe)
        assert fixture["fixtureSha256"] == sha256(fixture_bytes).hexdigest()
        result = FetchResult(
            status_code=200,
            headers={"content-type": fixture["mediaType"]},
            body=fixture_bytes,
            final_url=recipe.request.url_template,
            elapsed_ms=1,
        )
        assert ADAPTERS[recipe.adapter].parse(recipe, result)
