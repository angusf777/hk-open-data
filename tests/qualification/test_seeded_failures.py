from __future__ import annotations

from dataclasses import dataclass

from hk_data_worker.models import FetchResult
from hk_data_worker.monitor.evaluator import FetchFailure, evaluate

from ..contract.test_monitor_checks import NOW, baseline, payload, result, target


@dataclass(frozen=True)
class Seed:
    name: str
    evidence: FetchResult | FetchFailure
    expected_code: str


def seeds() -> list[Seed]:
    wrong_type = result(payload(), "text/html")
    required_removed = payload()
    del required_removed["items"]
    additive = payload()
    additive["optional"] = True
    changed_type = payload()
    changed_type["updated_at"] = 123
    identifier = payload()
    identifier["items"] = [{"id": "???", "value": 1}]
    missing_time = payload()
    del missing_time["updated_at"]
    stale = payload()
    stale["updated_at"] = "2026-08-28T08:00:00Z"
    empty_event = payload()
    empty_event["items"] = []
    bilingual = payload()
    bilingual["bilingual_peer_ids"] = ["B2"]
    geometry = payload()
    geometry["features"] = [{"geometry": {"type": "Point", "coordinates": [999.0, 22.3]}}]
    duplicate = payload()
    duplicate["items"] = [{"id": "A1"}, {"id": "A1"}]
    cursor = payload()
    cursor["meta"] = {"current_cursor": "loop", "next_cursor": "loop"}
    return [
        Seed("dns", FetchFailure(code="DNS_FAILURE", category="availability"), "DNS_FAILURE"),
        Seed(
            "connect timeout",
            FetchFailure(code="CONNECT_TIMEOUT", category="availability"),
            "CONNECT_TIMEOUT",
        ),
        Seed(
            "read timeout",
            FetchFailure(code="READ_TIMEOUT", category="availability"),
            "READ_TIMEOUT",
        ),
        Seed(
            "rate limited",
            result(payload()).model_copy(update={"status_code": 429}),
            "RATE_LIMITED",
        ),
        Seed(
            "server error",
            result(payload()).model_copy(update={"status_code": 500}),
            "HTTP_SERVER_ERROR",
        ),
        Seed(
            "private redirect",
            FetchFailure(code="REDIRECT_BLOCKED", category="security"),
            "REDIRECT_BLOCKED",
        ),
        Seed("wrong content type", wrong_type, "CONTENT_TYPE_MISMATCH"),
        Seed(
            "truncated JSON",
            result(payload()).model_copy(update={"body": b'{"items":['}),
            "PAYLOAD_INVALID",
        ),
        Seed(
            "oversized body",
            FetchFailure(code="BODY_TOO_LARGE", category="security"),
            "BODY_TOO_LARGE",
        ),
        Seed("required field removed", result(required_removed), "REQUIRED_FIELD_REMOVED"),
        Seed("optional field added", result(additive), "SCHEMA_ADDITIVE"),
        Seed("field type changed", result(changed_type), "FIELD_TYPE_CHANGED"),
        Seed("identifier semantics", result(identifier), "IDENTIFIER_INVALID"),
        Seed("provider timestamp missing", result(missing_time), "PROVIDER_TIMESTAMP_MISSING"),
        Seed("provider timestamp stale", result(stale), "FRESHNESS_EXCEEDED"),
        Seed("empty event feed", result(empty_event), "VALID_EMPTY_EVENT"),
        Seed("bilingual parity", result(bilingual), "BILINGUAL_IDENTIFIER_MISMATCH"),
        Seed("invalid geometry", result(geometry), "GEOMETRY_INVALID"),
        Seed("duplicate records", result(duplicate), "DUPLICATE_RECORD"),
        Seed("checkpoint loop", result(cursor), "CHECKPOINT_LOOP"),
    ]


def test_detects_at_least_ninety_five_percent_of_twenty_seed_classes() -> None:
    detected = 0
    all_seeds = seeds()
    for seed in all_seeds:
        configured = baseline()
        if seed.name == "provider timestamp missing":
            configured = configured.model_copy(update={"required_pointers": ("/items",)})
        observation = evaluate(target(), seed.evidence, configured, NOW, seeded_failure=True)
        codes = {check.code for check in observation.check_results}
        detected += seed.expected_code in codes
        assert observation.seeded_failure is True

    assert len(all_seeds) == 20
    assert detected / len(all_seeds) >= 0.95
