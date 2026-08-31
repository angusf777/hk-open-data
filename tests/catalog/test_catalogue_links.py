from __future__ import annotations

import json
from datetime import UTC, datetime

import httpx

from scripts.check_catalogue_links import check_urls


class SequenceTransport(httpx.BaseTransport):
    def __init__(self, statuses: list[int]) -> None:
        self.statuses = iter(statuses)

    def handle_request(self, request: httpx.Request) -> httpx.Response:
        return httpx.Response(next(self.statuses), request=request)


def record(url: str, *, checked_at: str = "2026-08-31") -> dict[str, object]:
    return {
        "id": "official:test",
        "type": "official",
        "urls": {"landing": url, "documentation": None, "terms": None},
        "verification": {"checkedAt": checked_at},
    }


def test_link_checker_retries_and_marks_failure_without_deleting() -> None:
    client = httpx.Client(transport=SequenceTransport([503, 503]))
    report = check_urls([record("https://example.test")], client=client, attempts=2)
    assert report.failures[0].resource_id == "official:test"
    assert report.failures[0].attempts == 2
    assert report.failures[0].status == "unavailable"
    assert report.deleted == []


def test_checker_redacts_query_strings() -> None:
    client = httpx.Client(transport=SequenceTransport([503]))
    report = check_urls(
        [record("https://example.test/data?api_key=secret")], client=client, attempts=1
    )
    assert "secret" not in report.to_json()
    assert "api_key" not in report.to_json()


def test_checker_uses_bounded_get_fallback_for_unsupported_head() -> None:
    client = httpx.Client(transport=SequenceTransport([405, 200]))
    report = check_urls([record("https://example.test/data")], client=client, attempts=1)
    assert report.findings[0].status == "ok"
    assert report.findings[0].attempts == 1


def test_stale_verification_is_reported_without_network_request() -> None:
    report = check_urls(
        [record("https://example.test", checked_at="2025-01-01")],
        client=httpx.Client(transport=SequenceTransport([200])),
        attempts=1,
        now=datetime(2026, 8, 31, tzinfo=UTC),
        stale_after_days=365,
    )
    parsed = json.loads(report.to_json())
    assert any(item["status"] == "stale-verification" for item in parsed["findings"])


def test_literal_private_target_is_rejected_before_request() -> None:
    report = check_urls(
        [record("http://127.0.0.1/secret")],
        client=httpx.Client(transport=SequenceTransport([])),
        attempts=1,
    )
    assert report.findings[0].status == "unsafe-target"
