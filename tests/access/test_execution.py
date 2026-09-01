from __future__ import annotations

from pathlib import Path

import pytest
from hk_data_worker.access.errors import AccessFailure
from hk_data_worker.access.execution import execute_recipe
from hk_data_worker.access.registry import load_recipes
from hk_data_worker.models import ApprovedRequest, FetchResult

FIXTURES = Path(__file__).parent / "fixtures"


class SpyFetcher:
    def __init__(self, body: bytes = b'{"success":true,"result":[]}') -> None:
        self.body = body
        self.requests: list[ApprovedRequest] = []

    def fetch(self, request: ApprovedRequest) -> FetchResult:
        self.requests.append(request)
        return FetchResult(
            status_code=200,
            headers={"content-type": "application/json"},
            body=self.body,
            final_url=request.url,
            elapsed_ms=12,
        )


def test_fixture_tested_fetch_requires_explicit_override() -> None:
    fetcher = SpyFetcher()
    recipe = load_recipes(FIXTURES / "valid")[0]

    with pytest.raises(AccessFailure) as caught:
        execute_recipe(recipe, {}, fetcher=fetcher)

    assert caught.value.code == "RECIPE_NOT_EXECUTABLE"
    assert fetcher.requests == []


def test_explicit_unverified_fetch_returns_records_and_metadata() -> None:
    fetcher = SpyFetcher(
        b'{"success":true,"result":[{"id":"one"},{"id":"two"}]}'
    )
    recipe = load_recipes(FIXTURES / "valid")[0]

    result = execute_recipe(recipe, {}, fetcher=fetcher, allow_unverified=True)

    assert len(result.records) == 2
    assert len(result.responses) == 1
    assert result.responses[0].response_bytes == len(fetcher.body)
    assert result.responses[0].response_sha256 not in fetcher.body.decode()
    assert len(fetcher.requests) == 1


def test_non_success_status_returns_stable_error_without_body() -> None:
    fetcher = SpyFetcher(b"provider secret")
    recipe = load_recipes(FIXTURES / "valid")[0]
    original = fetcher.fetch

    def failed(request: ApprovedRequest) -> FetchResult:
        return original(request).model_copy(update={"status_code": 403})

    fetcher.fetch = failed  # type: ignore[method-assign]

    with pytest.raises(AccessFailure) as caught:
        execute_recipe(recipe, {}, fetcher=fetcher, allow_unverified=True)

    assert caught.value.code == "SOURCE_UNAVAILABLE"
    assert "provider secret" not in str(caught.value)
