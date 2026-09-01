from __future__ import annotations

import pytest
from hk_data_worker.config import load_configuration

BASE_ENV = {
    "DATABASE_URL": "postgresql://local/runtime",
    "SOURCE_GROUPS_PATH": "packages/schemas/contracts/p01-source-groups.csv",
    "MONITOR_TARGETS_PATH": "packages/schemas/contracts/p14-monitor-targets.csv",
}


def test_default_profile_cannot_access_providers() -> None:
    configuration = load_configuration(BASE_ENV)

    assert configuration.profile == "catalogue"
    assert configuration.provider_access is False
    assert configuration.evidence_mode == "none"


def test_catalogue_rejects_external_requests_or_response_storage() -> None:
    with pytest.raises(ValueError, match="catalogue-only mode"):
        load_configuration(BASE_ENV | {"HKOD_ENABLE_PROVIDER_ACCESS": "true"})
    with pytest.raises(ValueError, match="catalogue-only mode"):
        load_configuration(BASE_ENV | {"HKOD_ENABLE_RAW_EVIDENCE": "true"})


def test_observe_requires_provider_opt_in_and_is_digest_only() -> None:
    with pytest.raises(ValueError, match="HKOD_ENABLE_PROVIDER_ACCESS"):
        load_configuration(BASE_ENV | {"HKOD_PROFILE": "observe"})

    configuration = load_configuration(
        BASE_ENV
        | {
            "HKOD_PROFILE": "observe",
            "HKOD_ENABLE_PROVIDER_ACCESS": "true",
        }
    )
    assert configuration.provider_access is True
    assert configuration.evidence_mode == "digest"
    assert configuration.object_store_endpoint is None


def test_fabric_requires_raw_opt_in_and_complete_object_store() -> None:
    with pytest.raises(ValueError, match="HKOD_ENABLE_RAW_EVIDENCE"):
        load_configuration(
            BASE_ENV
            | {
                "HKOD_PROFILE": "fabric",
                "HKOD_ENABLE_PROVIDER_ACCESS": "true",
            }
        )

    with pytest.raises(ValueError, match="OBJECT_STORE"):
        load_configuration(
            BASE_ENV
            | {
                "HKOD_PROFILE": "fabric",
                "HKOD_ENABLE_PROVIDER_ACCESS": "true",
                "HKOD_ENABLE_RAW_EVIDENCE": "true",
            }
        )

    configuration = load_configuration(
        BASE_ENV
        | {
            "HKOD_PROFILE": "fabric",
            "HKOD_ENABLE_PROVIDER_ACCESS": "true",
            "HKOD_ENABLE_RAW_EVIDENCE": "true",
            "OBJECT_STORE_ENDPOINT": "http://object-store:9000",
            "OBJECT_STORE_BUCKET": "raw",
            "OBJECT_STORE_ACCESS_KEY": "test-access",
            "OBJECT_STORE_SECRET_KEY": "test-secret",
        }
    )
    assert configuration.evidence_mode == "raw"
    assert configuration.object_store_bucket == "raw"


@pytest.mark.parametrize("profile", ["OBSERVE", "unknown", ""])
def test_profile_values_are_exact(profile: str) -> None:
    with pytest.raises(ValueError, match="HKOD_PROFILE"):
        load_configuration(BASE_ENV | {"HKOD_PROFILE": profile})
