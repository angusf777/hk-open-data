from __future__ import annotations

import gzip
import socket

import httpx
import pytest
from hk_data_worker.fetch import (
    BodyTooLarge,
    EgressDenied,
    FetchTimedOut,
    RetryExhausted,
    SafeFetcher,
    UnexpectedMediaType,
    UnsafeRedirect,
)
from hk_data_worker.models import ApprovedRequest


def request(
    url: str,
    *,
    cap: int = 1024,
    compressed_cap: int = 1024,
    attempts: int = 1,
    retry_status_codes: tuple[int, ...] = (408, 429, 500, 502, 503, 504),
    allowed_media_types: tuple[str, ...] = (),
) -> ApprovedRequest:
    return ApprovedRequest(
        method="GET",
        url=url,
        allowed_hosts=("public.example", "internal.example"),
        timeout_ms=1_000,
        max_response_bytes=cap,
        max_compressed_response_bytes=compressed_cap,
        max_attempts=attempts,
        retry_status_codes=retry_status_codes,
        allowed_media_types=allowed_media_types,
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

    with pytest.raises(UnsafeRedirect, match="redirect destination is not permitted"):
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


def test_non_configured_error_status_is_returned_without_retry() -> None:
    calls = 0

    def handler(outbound: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(500, content=b"{}", request=outbound)

    result = SafeFetcher(
        transport=httpx.MockTransport(handler),
        resolver=resolver,
    ).fetch(
        request(
            "https://public.example/data",
            attempts=3,
            retry_status_codes=(429,),
        )
    )

    assert result.status_code == 500
    assert calls == 1


def test_retry_exhaustion_has_stable_non_secret_error() -> None:
    fetcher = SafeFetcher(
        transport=httpx.MockTransport(
            lambda outbound: httpx.Response(503, content=b"secret body", request=outbound)
        ),
        resolver=resolver,
        sleeper=lambda _seconds: None,
    )

    with pytest.raises(RetryExhausted, match="configured retries were exhausted") as caught:
        fetcher.fetch(request("https://public.example/data", attempts=2))

    assert "secret" not in str(caught.value)


def test_rejects_unexpected_response_media_type_without_body() -> None:
    fetcher = SafeFetcher(
        transport=httpx.MockTransport(
            lambda outbound: httpx.Response(
                200,
                headers={"content-type": "text/html; charset=utf-8"},
                content=b"secret provider body",
                request=outbound,
            )
        ),
        resolver=resolver,
    )

    with pytest.raises(UnexpectedMediaType, match="not allowlisted") as caught:
        fetcher.fetch(
            request(
                "https://public.example/data",
                allowed_media_types=("application/json",),
            )
        )

    assert "secret" not in str(caught.value)
