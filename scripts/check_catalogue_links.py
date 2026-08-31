from __future__ import annotations

import argparse
import ipaddress
import json
import socket
from collections.abc import Callable, Iterable
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urljoin, urlsplit, urlunsplit

import httpx

ROOT = Path(__file__).parents[1]
USER_AGENT = "hk-open-data-link-health/0.1 (+https://github.com/angusf777/hk-open-data)"
Resolver = Callable[[str, int], object]


@dataclass(frozen=True)
class LinkFinding:
    resource_id: str
    field: str
    url: str
    status: str
    attempts: int
    http_status: int | None = None
    detail: str | None = None


@dataclass
class LinkReport:
    generated_at: str
    findings: tuple[LinkFinding, ...]
    deleted: list[str] = field(default_factory=list)

    @property
    def failures(self) -> tuple[LinkFinding, ...]:
        return tuple(
            item for item in self.findings if item.status not in {"ok", "redirected"}
        )

    def to_json(self) -> str:
        return json.dumps(
            {
                "generatedAt": self.generated_at,
                "summary": {
                    "checked": len(self.findings),
                    "failures": len(self.failures),
                    "deleted": 0,
                },
                "findings": [asdict(item) for item in self.findings],
                "deleted": list(self.deleted),
            },
            indent=2,
            sort_keys=True,
        ) + "\n"


def _clean_url(value: str) -> str:
    parsed = urlsplit(value)
    return urlunsplit((parsed.scheme.lower(), parsed.netloc, parsed.path or "/", "", ""))


def _address_is_public(value: str) -> bool:
    address = ipaddress.ip_address(value)
    return not (
        address.is_private
        or address.is_loopback
        or address.is_link_local
        or address.is_multicast
        or address.is_reserved
        or address.is_unspecified
    )


def _safe_url(value: str, resolver: Resolver | None) -> bool:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
        return False
    if parsed.username is not None or parsed.password is not None:
        return False
    try:
        return _address_is_public(parsed.hostname)
    except ValueError:
        pass
    if parsed.hostname.lower() == "localhost" or parsed.hostname.endswith(".localhost"):
        return False
    if resolver is None:
        return True
    try:
        port = parsed.port or (443 if parsed.scheme == "https" else 80)
        addresses = resolver(parsed.hostname, port)
    except OSError:
        return False
    if not isinstance(addresses, list):
        return False
    observed: set[str] = set()
    for item in addresses:
        if not isinstance(item, tuple) or len(item) < 5:
            continue
        address = item[4]
        if isinstance(address, tuple) and address:
            observed.add(str(address[0]))
    return bool(observed) and all(_address_is_public(address) for address in observed)


def _request_once(
    client: httpx.Client,
    value: str,
    *,
    resolver: Resolver | None,
    max_redirects: int,
) -> tuple[str, int | None, str | None]:
    current = value
    redirected = False
    for _ in range(max_redirects + 1):
        if not _safe_url(current, resolver):
            return "unsafe-target", None, "URL or redirect target is not public"
        try:
            response = client.head(current, follow_redirects=False)
            if response.status_code in {405, 501}:
                response = client.get(current, follow_redirects=False)
        except (httpx.TimeoutException, httpx.NetworkError) as error:
            return "unavailable", None, type(error).__name__
        if response.status_code in {301, 302, 303, 307, 308}:
            location = response.headers.get("location")
            if location is None:
                return "invalid", response.status_code, "redirect omitted Location"
            current = _clean_url(urljoin(current, location))
            redirected = True
            continue
        if 200 <= response.status_code < 400:
            return ("redirected" if redirected else "ok"), response.status_code, None
        if response.status_code == 429:
            return "rate-limited", 429, None
        return "unavailable", response.status_code, None
    return "invalid", None, f"redirect limit exceeded ({max_redirects})"


def _links(records: Iterable[dict[str, object]]) -> list[tuple[str, str, str, str | None]]:
    result: list[tuple[str, str, str, str | None]] = []
    seen: set[tuple[str, str]] = set()
    for record in records:
        if record.get("type") != "official":
            continue
        resource_id = str(record.get("id", "unknown"))
        urls = record.get("urls")
        verification = record.get("verification")
        checked_at = verification.get("checkedAt") if isinstance(verification, dict) else None
        if not isinstance(urls, dict):
            continue
        for url_field in ("landing", "documentation", "terms"):
            value = urls.get(url_field)
            if not isinstance(value, str) or not value:
                continue
            cleaned = _clean_url(value)
            key = (resource_id, cleaned)
            if key in seen:
                continue
            seen.add(key)
            result.append(
                (resource_id, url_field, cleaned, str(checked_at) if checked_at else None)
            )
    return result


def check_urls(
    records: Iterable[dict[str, object]],
    *,
    client: httpx.Client | None = None,
    attempts: int = 2,
    timeout_seconds: float = 8.0,
    max_redirects: int = 5,
    now: datetime | None = None,
    stale_after_days: int = 180,
    resolver: Resolver | None = None,
) -> LinkReport:
    if attempts < 1 or attempts > 3:
        raise ValueError("attempts must be between 1 and 3")
    clock = now or datetime.now(UTC)
    owned_client = client is None
    active_client = client or httpx.Client(
        headers={"User-Agent": USER_AGENT},
        timeout=httpx.Timeout(timeout_seconds),
        follow_redirects=False,
    )
    active_resolver = resolver
    if active_resolver is None and owned_client:
        active_resolver = socket.getaddrinfo
    findings: list[LinkFinding] = []
    try:
        for resource_id, field, value, checked_at in _links(records):
            if checked_at is not None:
                try:
                    age = (clock.date() - datetime.fromisoformat(checked_at).date()).days
                except ValueError:
                    age = stale_after_days + 1
                if age > stale_after_days:
                    findings.append(
                        LinkFinding(
                            resource_id,
                            field,
                            value,
                            "stale-verification",
                            0,
                            detail=f"verification evidence is {age} days old",
                        )
                    )
            status = "invalid"
            http_status: int | None = None
            detail: str | None = None
            used = 0
            for attempt_number in range(1, attempts + 1):
                used = attempt_number
                status, http_status, detail = _request_once(
                    active_client,
                    value,
                    resolver=active_resolver,
                    max_redirects=max_redirects,
                )
                if status in {"ok", "redirected", "unsafe-target", "invalid"}:
                    break
            findings.append(
                LinkFinding(resource_id, field, value, status, used, http_status, detail)
            )
    finally:
        if owned_client:
            active_client.close()
    return LinkReport(clock.isoformat(), tuple(findings))


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate a non-mutating catalogue link report")
    parser.add_argument(
        "--catalogue", type=Path, default=ROOT / "catalog/generated/catalogue.json"
    )
    parser.add_argument(
        "--output", type=Path, default=ROOT / "catalog/generated/link-health.json"
    )
    args = parser.parse_args()
    value = json.loads(args.catalogue.read_text(encoding="utf-8"))
    report = check_urls(value["resources"])
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(report.to_json(), encoding="utf-8")
    print(
        f"wrote {len(report.findings)} link observations with "
        f"{len(report.failures)} findings to {args.output}"
    )


if __name__ == "__main__":
    main()
