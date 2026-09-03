from __future__ import annotations

import json

import httpx
import pytest
from hk_data_sdk import ApiError, HKDataClient


def recipe_transport() -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/v1/access-recipes":
            return httpx.Response(
                200,
                json={
                    "items": [{"source_reference": "HKAPI-001"}],
                    "page": {"next_cursor": None},
                },
            )
        if request.url.path == "/v1/access-recipes/HKAPI-001":
            return httpx.Response(
                200,
                json={
                    "source_reference": "HKAPI-001",
                    "examples": {
                        "curl": "curl https://example.com/data",
                        "python": "import httpx\nhttpx.get('https://example.com/data')",
                        "typescript": "await fetch('https://example.com/data');",
                    },
                },
            )
        if request.url.path == "/v1/access-resources":
            return httpx.Response(
                200,
                json={
                    "items": [{"dataset_id": "dataset-one", "resource_id": "resource-one"}],
                    "page": {"next_cursor": None},
                },
            )
        if request.url.path == "/v1/access-resources/dataset-one/resource-one":
            return httpx.Response(
                200,
                json={
                    "dataset_id": "dataset-one",
                    "resource_id": "resource-one",
                    "url_template": "https://example.hk/data.json",
                },
            )
        return httpx.Response(
            404,
            json={
                "code": "NOT_FOUND",
                "message": "Access recipe was not found",
                "retryable": False,
                "correlation_id": "corr-access-1",
            },
        )

    return httpx.MockTransport(handler)


def test_python_sdk_reads_recipe_page_and_example() -> None:
    client = HKDataClient(
        base_url="https://api.example/v1",
        transport=recipe_transport(),
    )

    assert client.list_access_recipes()["items"] == [{"source_reference": "HKAPI-001"}]
    recipe = client.get_access_recipe("HKAPI-001")
    assert recipe["source_reference"] == "HKAPI-001"
    assert client.get_access_example("HKAPI-001", "python").startswith("import httpx")


def test_python_sdk_reads_provider_resource_page_and_detail() -> None:
    client = HKDataClient(
        base_url="https://api.example/v1",
        transport=recipe_transport(),
    )

    page = client.list_access_resources(source_reference="HKAPI-030", limit=10)
    resource = client.get_access_resource("dataset-one", "resource-one")

    assert page["items"][0]["resource_id"] == "resource-one"
    assert resource["url_template"] == "https://example.hk/data.json"


def test_python_sdk_rejects_invalid_example_language_before_request() -> None:
    def fail_if_called(_request: httpx.Request) -> httpx.Response:
        raise AssertionError("transport should not be called")

    client = HKDataClient(
        base_url="https://api.example/v1",
        transport=httpx.MockTransport(fail_if_called),
    )

    with pytest.raises(ValueError, match="curl, python, or typescript"):
        client.get_access_example("HKAPI-001", "ruby")


def test_python_sdk_preserves_the_common_unknown_recipe_error() -> None:
    client = HKDataClient(
        base_url="https://api.example/v1",
        transport=recipe_transport(),
    )

    with pytest.raises(ApiError) as raised:
        client.get_access_recipe("HKAPI-999")

    assert raised.value.status == 404
    assert raised.value.code == "NOT_FOUND"
    assert json.loads(json.dumps({"correlation_id": raised.value.correlation_id})) == {
        "correlation_id": "corr-access-1"
    }
