from __future__ import annotations

import ipaddress
import socket
import time
from collections.abc import Callable
from typing import Protocol, cast
from urllib.parse import urljoin, urlsplit

import httpx

from .models import ApprovedRequest, FetchResult


class Resolver(Protocol):
    def __call__(self, host: str, port: int, *, type: int) -> list[tuple[object, ...]]: ...


def _system_resolver(host: str, port: int, *, type: int) -> list[tuple[object, ...]]:
    return cast(list[tuple[object, ...]], socket.getaddrinfo(host, port, type=type))


class FetchError(RuntimeError):
    """Safe, non-secret-bearing fetch failure."""


class EgressDenied(FetchError):
    pass


class UnsafeRedirect(EgressDenied):
    pass


class BodyTooLarge(FetchError):
    pass


class FetchTimedOut(FetchError):
    pass


class RetryExhausted(FetchError):
    pass


class UnexpectedMediaType(FetchError):
    pass


class SafeFetcher:
    def __init__(
        self,
        *,
        transport: httpx.BaseTransport | None = None,
        resolver: Resolver = _system_resolver,
        max_redirects: int = 5,
        sleeper: Callable[[float], None] = time.sleep,
    ) -> None:
        self._transport = transport
        self._resolver = resolver
        self._max_redirects = max_redirects
        self._sleeper = sleeper

    @staticmethod
    def _retry_delay(response: httpx.Response | None, attempt: int) -> float:
        retry_after = None if response is None else response.headers.get("retry-after")
        if retry_after is not None and retry_after.isdigit():
            retry_seconds = float(str(retry_after))
            return 60.0 if retry_seconds > 60.0 else retry_seconds
        backoff_seconds = 0.25 * pow(2.0, attempt - 1)
        return 5.0 if backoff_seconds > 5.0 else backoff_seconds

    def _validate_destination(self, url: str, allowed_hosts: tuple[str, ...]) -> None:
        parsed = urlsplit(url)
        host = parsed.hostname
        if (
            parsed.scheme != "https"
            or host is None
            or parsed.username is not None
            or parsed.password is not None
            or parsed.fragment
        ):
            raise EgressDenied("destination must be a credential-free HTTPS URL")
        if parsed.port not in {None, 443}:
            raise EgressDenied("destination port is not approved")
        normalized_hosts = {allowed.lower().rstrip(".") for allowed in allowed_hosts}
        if host.lower().rstrip(".") not in normalized_hosts:
            raise EgressDenied("destination host is not allowlisted")
        try:
            addresses = self._resolver(host, 443, type=socket.SOCK_STREAM)
        except OSError as error:
            raise EgressDenied("destination DNS resolution failed") from error
        if not addresses:
            raise EgressDenied("destination DNS resolution returned no addresses")
        for result in addresses:
            sockaddr = result[4]
            if not isinstance(sockaddr, tuple) or not sockaddr:
                raise EgressDenied("destination DNS result is malformed")
            address = ipaddress.ip_address(str(sockaddr[0]))
            if not address.is_global:
                raise EgressDenied("destination resolves to a non-public address")

    def fetch(self, request: ApprovedRequest) -> FetchResult:
        started = time.monotonic()
        timeout = httpx.Timeout(request.timeout_ms / 1_000)
        with httpx.Client(
            transport=self._transport,
            timeout=timeout,
            follow_redirects=False,
        ) as client:
            for attempt in range(1, request.max_attempts + 1):
                current_url = request.url
                for redirect_count in range(self._max_redirects + 1):
                    self._validate_destination(current_url, request.allowed_hosts)
                    try:
                        with client.stream(
                            request.method,
                            current_url,
                            headers=request.headers,
                            content=request.body,
                        ) as response:
                            if response.is_redirect:
                                location = response.headers.get("location")
                                if location is None:
                                    raise FetchError("redirect response omitted Location")
                                if redirect_count == self._max_redirects:
                                    raise FetchError("redirect limit exceeded")
                                redirected_url = urljoin(current_url, location)
                                try:
                                    self._validate_destination(
                                        redirected_url,
                                        request.allowed_hosts,
                                    )
                                except EgressDenied as error:
                                    raise UnsafeRedirect(
                                        "redirect destination is not permitted"
                                    ) from error
                                current_url = redirected_url
                                continue
                            content_type = response.headers.get("content-type")
                            media_type = (
                                None
                                if content_type is None
                                else content_type.partition(";")[0].strip().lower()
                            )
                            allowed_media_types = {
                                value.lower() for value in request.allowed_media_types
                            }
                            if allowed_media_types and media_type not in allowed_media_types:
                                raise UnexpectedMediaType(
                                    "provider response media type is not allowlisted"
                                )
                            body = bytearray()
                            content_length = response.headers.get("content-length")
                            if (
                                content_length is not None
                                and content_length.isdigit()
                                and int(content_length) > request.max_compressed_response_bytes
                            ):
                                raise BodyTooLarge(
                                    "compressed response exceeded "
                                    f"{request.max_compressed_response_bytes} bytes"
                                )
                            for chunk in response.iter_bytes():
                                if (
                                    response.num_bytes_downloaded
                                    > request.max_compressed_response_bytes
                                ):
                                    raise BodyTooLarge(
                                        "compressed response exceeded "
                                        f"{request.max_compressed_response_bytes} bytes"
                                    )
                                if len(body) + len(chunk) > request.max_response_bytes:
                                    raise BodyTooLarge(
                                        f"response exceeded {request.max_response_bytes} bytes"
                                    )
                                body.extend(chunk)
                            retryable = response.status_code in request.retry_status_codes
                            if retryable and attempt < request.max_attempts:
                                self._sleeper(self._retry_delay(response, attempt))
                                break
                            if retryable:
                                raise RetryExhausted("configured retries were exhausted")
                            return FetchResult(
                                status_code=response.status_code,
                                headers={
                                    key.lower(): value for key, value in response.headers.items()
                                },
                                body=bytes(body),
                                final_url=current_url,
                                elapsed_ms=max(0, round((time.monotonic() - started) * 1_000)),
                            )
                    except httpx.TimeoutException as error:
                        if attempt >= request.max_attempts:
                            raise FetchTimedOut("provider request timed out") from error
                        self._sleeper(self._retry_delay(None, attempt))
                        break
                    except httpx.HTTPError as error:
                        if attempt >= request.max_attempts:
                            raise FetchError("provider request failed") from error
                        self._sleeper(self._retry_delay(None, attempt))
                        break
        raise FetchError("request completed without a response")
