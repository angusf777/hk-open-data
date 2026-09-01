from __future__ import annotations

import json
from pathlib import Path

from hk_data_worker.access.registry import load_recipes

from scripts.data_gov_recipes import load_mapping, promoted_recipe

ROOT = Path(__file__).parents[2]


def test_every_reviewed_mapping_has_a_bounded_resource_index_recipe() -> None:
    mapping = load_mapping(ROOT / "access" / "data-gov-datasets.yml")
    recipes = {
        recipe.source_reference: recipe
        for recipe in load_recipes(ROOT / "access" / "recipes" / "official")
    }

    for reference, dataset_ids in mapping.items():
        recipe = recipes[reference]
        assert recipe.adapter == "data-gov-resource-index"
        assert recipe.status.value in {"fixture-tested", "live-verified"}
        assert recipe.request is not None
        assert recipe.response is not None
        parameter = recipe.request.parameters[0]
        assert parameter.name == "id"
        assert parameter.default == dataset_ids[0]
        assert parameter.enum == dataset_ids
        assert "resource URLs" in " ".join(recipe.limitations)


def test_resource_index_recipes_cannot_escape_the_reviewed_mapping() -> None:
    mapping = load_mapping(ROOT / "access" / "data-gov-datasets.yml")
    recipes = load_recipes(ROOT / "access" / "recipes" / "official")

    actual = {
        recipe.source_reference
        for recipe in recipes
        if recipe.adapter == "data-gov-resource-index"
    }

    assert actual == set(mapping)


def test_promotion_requires_live_evidence_to_be_supplied_separately() -> None:
    recipe = load_recipes(ROOT / "access" / "recipes" / "official")[0]
    value = recipe.model_dump(mode="json", by_alias=True)

    fixture = promoted_recipe(value, ("reviewed-dataset",))
    live = promoted_recipe(value, ("reviewed-dataset",), status="live-verified")

    assert fixture.status.value == "fixture-tested"
    assert live.status.value == "live-verified"


def test_dataset_level_live_evidence_covers_every_reviewed_identifier() -> None:
    mapping = load_mapping(ROOT / "access" / "data-gov-datasets.yml")
    manifest = json.loads(
        (
            ROOT
            / "access"
            / "verification"
            / "data-gov-datasets"
            / "manifest.json"
        ).read_text(encoding="utf-8")
    )
    expected: dict[str, list[str]] = {}
    for reference, dataset_ids in mapping.items():
        for dataset_id in dataset_ids:
            expected.setdefault(dataset_id, []).append(reference)

    assert manifest["provenance"] == "live-metadata-only"
    assert manifest["sourceCount"] == len(mapping) == 190
    assert manifest["sourceDatasetMappings"] == sum(map(len, mapping.values())) == 356
    assert manifest["uniqueDatasetIds"] == len(expected) == 350
    assert manifest["successes"] == 350
    assert manifest["failures"] == 0
    assert set(manifest["datasets"]) == set(expected)
    for dataset_id, references in expected.items():
        evidence = manifest["datasets"][dataset_id]
        assert evidence["sourceReferences"] == sorted(references)
        assert evidence["outcome"] == "success"
        assert evidence["responseSha256"]
