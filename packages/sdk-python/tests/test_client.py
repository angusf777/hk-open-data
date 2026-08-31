from __future__ import annotations

import httpx
import pytest
from hk_data_sdk.client import ApiError, HKDataClient


def test_adds_auth_and_follows_opaque_pagination() -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        cursor = request.url.params.get("cursor")
        if cursor is None:
            return httpx.Response(
                200,
                json={"items": [{"source_id": "HKAPI-001"}], "page": {"next_cursor": "opaque"}},
            )
        return httpx.Response(
            200,
            json={"items": [{"source_id": "HKAPI-002"}], "page": {"next_cursor": None}},
        )

    client = HKDataClient(
        base_url="https://api.example/v1",
        token="secret-token",
        transport=httpx.MockTransport(handler),
    )

    assert [item["source_id"] for item in client.list_all_sources(project="P01", limit=1)] == [
        "HKAPI-001",
        "HKAPI-002",
    ]
    assert requests[0].headers["authorization"] == "Bearer secret-token"
    assert requests[1].url.params["cursor"] == "opaque"


def test_exposes_safe_error_envelope() -> None:
    transport = httpx.MockTransport(
        lambda _request: httpx.Response(
            403,
            json={
                "code": "FORBIDDEN",
                "message": "Missing scope",
                "retryable": False,
                "correlation_id": "corr-1",
            },
        )
    )
    client = HKDataClient(base_url="https://api.example/v1", transport=transport)

    with pytest.raises(ApiError) as caught:
        client.get_source("HKAPI-001")
    assert caught.value.code == "FORBIDDEN"
    assert caught.value.correlation_id == "corr-1"
    assert "secret" not in str(caught.value)


def test_timeout_is_mapped_without_transport_details() -> None:
    def timeout(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("token=secret", request=request)

    client = HKDataClient(
        base_url="https://api.example/v1",
        transport=httpx.MockTransport(timeout),
    )

    with pytest.raises(TimeoutError, match="timed out") as caught:
        client.status_summary()
    assert "secret" not in str(caught.value)
