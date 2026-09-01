from __future__ import annotations

import json
from hashlib import sha256
from pathlib import Path

from hk_data_worker.access.generation import recipe_sha256
from hk_data_worker.access.planning import plan_request
from hk_data_worker.access.registry import load_recipes
from hk_data_worker.adapters import ADAPTERS
from hk_data_worker.models import FetchResult

ROOT = Path(__file__).parents[2]
RECIPES = ROOT / "access" / "recipes" / "official"
FIXTURES = ROOT / "tests" / "fixtures" / "access" / "official"
OFFICIAL_REFERENCES = {f"HKAPI-{number:03d}" for number in range(1, 266)}


def test_every_published_official_resource_has_exactly_one_recipe() -> None:
    recipes = load_recipes(RECIPES)
    references = [recipe.source_reference for recipe in recipes]

    assert set(references) == OFFICIAL_REFERENCES
    assert len(references) == len(set(references)) == 265


def test_every_executable_recipe_has_a_hashed_synthetic_fixture() -> None:
    recipes = {recipe.source_reference: recipe for recipe in load_recipes(RECIPES)}
    manifest = json.loads((FIXTURES / "manifest.json").read_text(encoding="utf-8"))
    executable = {
        reference for reference, recipe in recipes.items() if recipe.request is not None
    }

    assert set(manifest) == executable
    for reference, fixture in manifest.items():
        recipe = recipes[reference]
        request_fixture = json.loads(
            (FIXTURES / fixture["requestFixture"]).read_text(encoding="utf-8")
        )
        response_body = (FIXTURES / fixture["responseFixture"]).read_bytes()
        assert fixture["sourceReference"] == reference
        assert fixture["recipeSha256"] == recipe_sha256(recipe)
        assert fixture["responseSha256"] == sha256(response_body).hexdigest()
        assert fixture["provenance"] == "synthetic-authored"
        assert fixture["documentationUrl"] == recipe.documentation_url
        planned = plan_request(recipe, request_fixture["parameters"], environ={})
        assert [request.model_dump(mode="json") for request in planned] == request_fixture[
            "approvedRequests"
        ]
        parsed = ADAPTERS[recipe.adapter].parse(
            recipe,
            FetchResult(
                status_code=200,
                headers={"content-type": fixture["mediaType"]},
                body=response_body,
                final_url=planned[0].url,
                elapsed_ms=1,
            ),
        )
        assert parsed


def test_non_executable_recipes_explain_the_manual_boundary() -> None:
    for recipe in load_recipes(RECIPES):
        if recipe.request is None:
            assert recipe.reason
            assert recipe.next_action
