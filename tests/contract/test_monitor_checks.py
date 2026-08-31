from __future__ import annotations

import json
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest
from hk_data_worker.models import FetchResult, MonitorTarget
from hk_data_worker.monitor.baseline import (
    MaintenanceWindow,
    MonitorBaseline,
    activate_baseline,
    schema_shape,
)
from hk_data_worker.monitor.evaluator import evaluate
from jsonschema import Draft202012Validator

NOW = datetime(2026, 8, 28, 10, tzinfo=UTC)


def payload() -> dict[str, object]:
    return {
        "items": [{"id": "A1", "value": 1}],
        "updated_at": "2026-08-28T09:55:00Z",
        "bilingual_peer_ids": ["A1"],
        "features": [{"geometry": {"type": "Point", "coordinates": [114.2, 22.3]}}],
        "meta": {"current_cursor": "a", "next_cursor": "b"},
    }


def target(freshness_rule: str = "provider_timestamp_age<=1800") -> MonitorTarget:
    return MonitorTarget(
        monitor_id="P14-M001",
        source_id="HKAPI-001",
        source_group_id="P01-SG-01",
        provider="Provider",
        name="Fixture",
        method="GET",
        request_template="https://provider.example/data",
        request_body_json=None,
        cadence_seconds=60,
        timeout_ms=1_000,
        freshness_rule=freshness_rule,
        required_checks=("availability", "json", "schema", "freshness", "semantic"),
        public_visibility="pending_review",
        activation_status="specified_pending_approval",
        documentation_url="https://provider.example/docs",
        notes="fixture",
    )


def baseline() -> MonitorBaseline:
    value = payload()
    return MonitorBaseline(
        baseline_version="1",
        schema_shape=schema_shape(value),
        required_pointers=("/items", "/updated_at"),
        identifier_pointer="/items/*/id",
        identifier_pattern=r"^[A-Z][0-9]+$",
        provider_timestamp_pointer="/updated_at",
        max_age_seconds=1_800,
        event_list_pointer="/items",
        bilingual_primary_pointer="/items/*/id",
        bilingual_peer_pointer="/bilingual_peer_ids/*",
        geometry_pointer="/features/*/geometry",
        cursor_current_pointer="/meta/current_cursor",
        cursor_next_pointer="/meta/next_cursor",
    )


def result(value: dict[str, object], content_type: str = "application/json") -> FetchResult:
    return FetchResult(
        status_code=200,
        headers={"content-type": content_type},
        body=json.dumps(value).encode(),
        final_url="https://provider.example/data",
        elapsed_ms=100,
    )


def test_missing_provider_time_is_unknown_not_fresh() -> None:
    value = payload()
    del value["updated_at"]
    configured = baseline().model_copy(update={"required_pointers": ("/items",)})
    observation = evaluate(target(), result(value), configured, NOW)

    assert any(check.code == "PROVIDER_TIMESTAMP_MISSING" for check in observation.check_results)
    assert observation.provider_timestamp is None
    assert observation.outcome == "unknown"


def test_provider_time_without_timezone_is_unknown() -> None:
    value = payload()
    value["updated_at"] = "2026-08-28T09:55:00"
    observation = evaluate(target(), result(value), baseline(), NOW)

    assert any(check.code == "PROVIDER_TIMEZONE_MISSING" for check in observation.check_results)
    assert observation.provider_timestamp is None
    assert observation.outcome == "unknown"


def test_optional_field_addition_is_compatible() -> None:
    value = payload()
    value["new_optional"] = "safe"
    observation = evaluate(target(), result(value), baseline(), NOW)

    assert any(check.code == "SCHEMA_ADDITIVE" for check in observation.check_results)
    assert observation.outcome == "pass"


def test_duplicate_identifiers_fail_semantic_check() -> None:
    value = payload()
    value["items"] = [{"id": "A1", "value": 1}, {"id": "A1", "value": 2}]
    observation = evaluate(target(), result(value), baseline(), NOW)

    assert any(check.code == "DUPLICATE_RECORD" for check in observation.check_results)
    assert observation.outcome == "fail"


def test_empty_event_feed_passes_without_inventing_a_recent_event() -> None:
    value = payload()
    value["items"] = []
    configured = baseline().model_copy(
        update={
            "schema_shape": schema_shape(value),
            "required_pointers": ("/updated_at",),
        }
    )
    observation = evaluate(target(), result(value), configured, NOW)

    assert any(check.code == "VALID_EMPTY_EVENT" for check in observation.check_results)
    assert observation.outcome == "pass"


@pytest.mark.parametrize(
    ("mutate", "code"),
    [
        (lambda value: value.pop("updated_at"), "REQUIRED_FIELD_REMOVED"),
        (lambda value: value.__setitem__("updated_at", 123), "FIELD_TYPE_CHANGED"),
        (
            lambda value: value["items"].__setitem__(0, {"id": "changed-semantics"}),
            "IDENTIFIER_INVALID",
        ),
    ],
)
def test_breaking_contract_and_identifier_changes_fail(
    mutate: Callable[[dict[str, object]], object], code: str
) -> None:
    value = payload()
    mutate(value)
    observation = evaluate(target(), result(value), baseline(), NOW)

    assert any(check.code == code for check in observation.check_results)
    assert observation.outcome == "fail"


def test_bilingual_pairs_compare_identifiers_not_literal_translations() -> None:
    compatible = payload()
    compatible["items"] = [{"id": "A1", "label": "Central"}]
    compatible["bilingual_peer_ids"] = ["A1"]
    passed = evaluate(target(), result(compatible), baseline(), NOW)
    assert not any(check.code == "BILINGUAL_IDENTIFIER_MISMATCH" for check in passed.check_results)

    incompatible = payload()
    incompatible["bilingual_peer_ids"] = ["B2"]
    failed = evaluate(target(), result(incompatible), baseline(), NOW)
    assert any(check.code == "BILINGUAL_IDENTIFIER_MISMATCH" for check in failed.check_results)
    assert failed.outcome == "fail"


@pytest.mark.parametrize(
    "geometry_update",
    [
        {"type": "Point", "coordinates": [181, 22.3]},
        {"type": "LineString", "coordinates": [[114.2, 22.3], [114.3, 91]]},
        {"x": 181, "y": 22.3, "spatialReference": {"wkid": 4326}},
        {"x": 114.2, "y": 22.3, "spatialReference": {"wkid": 2326}},
    ],
)
def test_invalid_geojson_arcgis_bounds_and_crs_fail(
    geometry_update: dict[str, object],
) -> None:
    value = payload()
    value["features"] = [{"geometry": geometry_update}]
    observation = evaluate(target(), result(value), baseline(), NOW)

    assert any(check.code == "GEOMETRY_INVALID" for check in observation.check_results)
    assert observation.outcome == "fail"


def test_baseline_activation_retains_reviewed_version_diff() -> None:
    value = payload()
    value["optional"] = True
    updated, change = activate_baseline(
        baseline(),
        value,
        evidence_observation_ids=("OBS-BASE0001",),
        operator_identity="local-operator",
        activated_at=NOW,
    )

    assert updated.baseline_version == "2"
    assert change.prior_version == "1"
    assert "/optional" in change.added_pointers
    assert change.operator_identity == "local-operator"


def test_observation_validates_against_normative_schema() -> None:
    observation = evaluate(target(), result(payload()), baseline(), NOW)
    schema_path = (
        Path(__file__).resolve().parents[2]
        / "packages"
        / "schemas"
        / "contracts"
        / "monitor_observation.schema.json"
    )
    schema = json.loads(schema_path.read_text(encoding="utf-8"))

    Draft202012Validator(schema).validate(observation.model_dump(mode="json"))


def test_maintenance_requires_provider_evidence_or_active_owned_window() -> None:
    provider_payload = payload()
    provider_payload["status"] = "scheduled_maintenance"
    provider_baseline = baseline().model_copy(update={"maintenance_pointer": "/status"})
    provider = evaluate(target(), result(provider_payload), provider_baseline, NOW)
    assert provider.outcome == "maintenance"
    assert provider.check_results[0].code == "PROVIDER_MAINTENANCE_EVIDENCE"

    window = MaintenanceWindow(
        owner="operator@example.gov.hk",
        reason="Published provider change window",
        evidence_url="https://provider.example/maintenance/1",
        starts_at=NOW - timedelta(minutes=5),
        expires_at=NOW + timedelta(minutes=5),
    )
    operator = evaluate(
        target(),
        result(payload()),
        baseline(),
        NOW,
        maintenance_window=window,
    )
    assert operator.outcome == "maintenance"
    assert operator.check_results[0].code == "OPERATOR_MAINTENANCE_WINDOW"

    expired = evaluate(
        target(),
        result(payload()),
        baseline(),
        NOW + timedelta(minutes=6),
        maintenance_window=window,
    )
    assert expired.outcome != "maintenance"
