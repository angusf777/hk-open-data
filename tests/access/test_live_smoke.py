from __future__ import annotations

import os
from pathlib import Path

import pytest
from hk_data_worker.access.live import verify_all_anonymous
from hk_data_worker.access.registry import load_recipes
from hk_data_worker.fetch import SafeFetcher

pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_ACCESS_TESTS") != "1",
    reason="set RUN_LIVE_ACCESS_TESTS=1 for bounded official endpoint checks",
)


def test_all_anonymous_recipes_plan_fetch_parse_and_normalize() -> None:
    root = Path(__file__).parents[2]
    recipes = load_recipes(root / "access/recipes/official")

    results = verify_all_anonymous(
        recipes,
        output=root / "access/verification",
        fetcher=SafeFetcher(),
        concurrency=1,
    )

    assert results
    assert all(result.source_reference.startswith("HKAPI-") for result in results)
    assert all(result.outcome in {"success", "failure"} for result in results)
