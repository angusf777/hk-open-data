from __future__ import annotations

import gzip
import socket

import httpx
import pytest
from hk_data_worker.fetch import (
    BodyTooLarge,
    EgressDenied,
    FetchTimedOut,
    SafeFetcher,
)
from hk_data_worker.models import ApprovedRequest


def request(
    url: str, *, cap: int = 1024, compressed_cap: int = 1024, attempts: int = 1
) -> ApprovedRequest:
    return ApprovedRequest(
        method="GET",
        url=url,
        allowed_hosts=("public.example", "internal.example"),
        timeout_ms=1_000,
        max_response_bytes=cap,
        max_compressed_response_bytes=compressed_cap,
        max_attempts=attempts,
    )


def resolver(host: str, port: int, type: int = socket.SOCK_STREAM) -> list[tuple[object, ...]]:
    del port, type
    address = "127.0.0.1" if host == "internal.example" else "8.8.8.8"
    return [(socket.AF_INET, socket.SOCK_STREAM, 6, "", (address, 443))]


def test_rejects_loopback_before_transport() -> None:
    called = False

    def transport_handler(request: httpx.Request) -> httpx.Response:
        nonlocal called
        called = True
        return httpx.Response(200, content=b"should not run", request=request)

    fetcher = SafeFetcher(
        transport=httpx.MockTransport(transport_handler),
        resolver=lambda *_args, **_kwargs: [
            (socket.AF_INET, socket.SOCK_STREAM, 6, "", ("127.0.0.1", 443))
        ],
    )

    with pytest.raises(EgressDenied, match="non-public"):
        fetcher.fetch(request("https://public.example/data"))
    assert called is False


def test_rejects_redirect_to_private_destination() -> None:
    def transport_handler(outbound: httpx.Request) -> httpx.Response:
        return httpx.Response(
            302,
            headers={"location": "https://internal.example/admin"},
            request=outbound,
        )

    fetcher = SafeFetcher(transport=httpx.MockTransport(transport_handler), resolver=resolver)

    with pytest.raises(EgressDenied, match="non-public"):
        fetcher.fetch(request("https://public.example/data"))


def test_enforces_streamed_response_cap() -> None:
    fetcher = SafeFetcher(
        transport=httpx.MockTransport(
            lambda outbound: httpx.Response(200, content=b"123456", request=outbound)
        ),
        resolver=resolver,
    )

    with pytest.raises(BodyTooLarge, match="5 bytes"):
        fetcher.fetch(request("https://public.example/data", cap=5))


def test_enforces_compressed_and_expanded_response_caps() -> None:
    declared = SafeFetcher(
        transport=httpx.MockTransport(
            lambda outbound: httpx.Response(
                200,
                headers={"content-length": "20"},
                content=b"small",
                request=outbound,
            )
        ),
        resolver=resolver,
    )
    with pytest.raises(BodyTooLarge, match="compressed response"):
        declared.fetch(request("https://public.example/data", compressed_cap=10))

    compressed = gzip.compress(b"A" * 2_000)
    archive_bomb = SafeFetcher(
        transport=httpx.MockTransport(
            lambda outbound: httpx.Response(
                200,
                headers={"content-encoding": "gzip"},
                content=compressed,
                request=outbound,
            )
        ),
        resolver=resolver,
    )
    with pytest.raises(BodyTooLarge, match="100 bytes"):
        archive_bomb.fetch(
            request(
                "https://public.example/data",
                cap=100,
                compressed_cap=len(compressed) + 10,
            )
        )


def test_maps_transport_timeout_without_leaking_request_data() -> None:
    def timeout(outbound: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("secret=do-not-log", request=outbound)

    fetcher = SafeFetcher(transport=httpx.MockTransport(timeout), resolver=resolver)

    with pytest.raises(FetchTimedOut, match="timed out") as caught:
        fetcher.fetch(request("https://public.example/data"))
    assert "secret" not in str(caught.value)


def test_retries_only_configured_transient_statuses_and_honours_retry_after() -> None:
    statuses = iter(
        [
            (429, {"retry-after": "2"}),
            (500, {}),
            (200, {}),
        ]
    )
    sleeps: list[float] = []

    def handler(outbound: httpx.Request) -> httpx.Response:
        status, headers = next(statuses)
        return httpx.Response(status, headers=headers, content=b"{}", request=outbound)

    result = SafeFetcher(
        transport=httpx.MockTransport(handler),
        resolver=resolver,
        sleeper=sleeps.append,
    ).fetch(request("https://public.example/data", attempts=3))

    assert result.status_code == 200
    assert sleeps == [2.0, 0.5]
