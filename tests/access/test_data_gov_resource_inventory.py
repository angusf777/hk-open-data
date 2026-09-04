from __future__ import annotations

import json
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlsplit

import pytest
from hk_data_worker.access.resources import DataGovResourceInventory, build_resource
from hk_data_worker.fetch import FetchSampleResult
from hk_data_worker.models import ApprovedRequest, FetchResult

from scripts.data_gov_resources import (
    fetch_packages,
    inventory_from_packages,
    inventory_summary,
    probe_representatives,
    probe_status_document,
    write_inventory_atomic,
)


class PackageFetcher:
    def __init__(self) -> None:
        self.requests: list[ApprovedRequest] = []

    def fetch(self, request: ApprovedRequest) -> FetchResult:
        self.requests.append(request)
        dataset_id = parse_qs(urlsplit(request.url).query)["id"][0]
        body = json.dumps(
            {
                "success": True,
                "result": {
                    "id": dataset_id,
                    "resources": [
                        {
                            "id": f"{dataset_id}-resource",
                            "name": "Current data",
                            "format": "JSON",
                            "url": f"https://example.hk/{dataset_id}.json",
                        }
                    ],
                },
            }
        ).encode()
        return FetchResult(
            status_code=200,
            headers={"content-type": "application/json"},
            body=body,
            final_url=request.url,
            elapsed_ms=1,
        )


def test_inventory_joins_dataset_resources_to_every_mapped_source() -> None:
    inventory = inventory_from_packages(
        {
            "HKAPI-030": ("dataset-one",),
            "HKAPI-031": ("dataset-one",),
        },
        {
            "dataset-one": {
                "id": "dataset-one",
                "title": "Example transport dataset",
                "notes": "Current routes and stops.",
                "organization": {"title": "Transport Department"},
                "metadata_modified": "2026-09-02T04:05:06.000000",
                "resources": [
                    {
                        "id": "resource-one",
                        "name": "Current data",
                        "format": "JSON",
                        "url": "https://example.hk/current.json",
                    },
                    {
                        "id": "resource-two",
                        "name": "Legacy data",
                        "format": "CSV",
                        "url": "http://example.hk/legacy.csv",
                    },
                ],
            }
        },
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
    )

    assert len(inventory.resources) == 2
    assert inventory.datasets[0].model_dump(mode="json", by_alias=True) == {
        "schemaVersion": 1,
        "sourceReferences": ["HKAPI-030", "HKAPI-031"],
        "datasetId": "dataset-one",
        "title": "Example transport dataset",
        "description": "Current routes and stops.",
        "providerName": "Transport Department",
        "landingUrl": "https://data.gov.hk/en-data/dataset/dataset-one",
        "modifiedAt": "2026-09-02T04:05:06.000000",
        "resourceCount": 2,
        "formats": ["CSV", "JSON"],
    }
    assert inventory.resources[0].source_references == ("HKAPI-030", "HKAPI-031")
    assert inventory.resources[0].resource_id == "resource-one"
    assert inventory.resources[1].access == "insecure-http"
    assert inventory_summary(inventory) == {
        "datasets": 1,
        "resources": 2,
        "ready": 1,
        "parameters-required": 0,
        "insecure-http": 1,
        "invalid-url": 0,
    }


def test_inventory_rejects_package_id_mismatch() -> None:
    with pytest.raises(ValueError, match="dataset-one"):
        inventory_from_packages(
            {"HKAPI-030": ("dataset-one",)},
            {
                "dataset-one": {
                    "id": "different",
                    "name": "also-different",
                    "resources": [],
                }
            },
            checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        )


def test_inventory_accepts_package_uuid_when_name_matches_dataset_slug() -> None:
    inventory = inventory_from_packages(
        {"HKAPI-030": ("dataset-one",)},
        {
            "dataset-one": {
                "id": "67342bae-3fc4-470b-895b-cd707f8f9ab9",
                "name": "dataset-one",
                "resources": [],
            }
        },
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
    )

    assert inventory.resources == ()


def test_inventory_rejects_missing_mapped_package() -> None:
    with pytest.raises(ValueError, match="dataset-one"):
        inventory_from_packages(
            {"HKAPI-030": ("dataset-one",)},
            {},
            checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        )


def test_fetch_packages_fetches_each_unique_dataset_once() -> None:
    fetcher = PackageFetcher()

    packages = fetch_packages(
        {
            "HKAPI-030": ("dataset-one",),
            "HKAPI-031": ("dataset-one", "dataset-two"),
        },
        fetcher=fetcher,
        concurrency=2,
    )

    assert sorted(packages) == ["dataset-one", "dataset-two"]
    assert len(fetcher.requests) == 2
    assert all(request.allowed_hosts == ("data.gov.hk",) for request in fetcher.requests)
    assert all(request.max_response_bytes == 5 * 1024 * 1024 for request in fetcher.requests)


def test_fetch_packages_rejects_unsuccessful_provider_response() -> None:
    class FailedPackageFetcher:
        def fetch(self, request: ApprovedRequest) -> FetchResult:
            return FetchResult(
                status_code=404,
                headers={"content-type": "application/json"},
                body=b'{"success": false}',
                final_url=request.url,
                elapsed_ms=1,
            )

    with pytest.raises(ValueError, match="dataset-one"):
        fetch_packages(
            {"HKAPI-030": ("dataset-one",)},
            fetcher=FailedPackageFetcher(),
        )


def test_write_inventory_atomic_round_trips(tmp_path) -> None:
    inventory = inventory_from_packages(
        {"HKAPI-030": ("dataset-one",)},
        {
            "dataset-one": {
                "id": "dataset-one",
                "resources": [
                    {
                        "id": "resource-one",
                        "name": "Current data",
                        "format": "JSON",
                        "url": "https://example.hk/current.json",
                    }
                ],
            }
        },
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
    )
    path = tmp_path / "nested" / "resources.json"

    write_inventory_atomic(path, inventory)

    assert path.read_text(encoding="utf-8").endswith("\n")
    assert json.loads(path.read_text(encoding="utf-8"))["resources"][0]["resourceId"] == (
        "resource-one"
    )


def test_probe_representatives_uses_fallback_and_stores_no_body() -> None:
    inventory = DataGovResourceInventory(
        schema_version=1,
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        package_endpoint="https://data.gov.hk/en-data/api/3/action/package_show",
        resources=(
            build_resource(
                "dataset-one",
                ("HKAPI-030",),
                {
                    "id": "api-resource",
                    "name": "First API",
                    "format": "API",
                    "url": "https://example.hk/fails",
                },
            ),
            build_resource(
                "dataset-one",
                ("HKAPI-030",),
                {
                    "id": "json-resource",
                    "name": "Second JSON",
                    "format": "JSON",
                    "url": "https://example.hk/works",
                },
            ),
        ),
    )

    class SampleFetcher:
        def fetch_sample(self, request: ApprovedRequest, *, sample_bytes: int) -> FetchSampleResult:
            if request.url.endswith("/fails"):
                return FetchSampleResult(
                    status_code=503,
                    headers={"content-type": "text/plain"},
                    body=b"unavailable",
                    final_url=request.url,
                    elapsed_ms=4,
                    truncated=False,
                )
            return FetchSampleResult(
                status_code=200,
                headers={"content-type": "application/json"},
                body=b'{"ok":true}',
                final_url=request.url,
                elapsed_ms=3,
                truncated=False,
            )

    report = probe_representatives(
        inventory,
        fetcher=SampleFetcher(),
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        inventory_sha256="a" * 64,
        sample_bytes=64,
        max_candidates=2,
    )

    assert report["successes"] == 1
    assert report["failures"] == 0
    dataset = report["datasets"]["dataset-one"]
    assert dataset["selectedResourceId"] == "json-resource"
    assert [attempt["outcome"] for attempt in dataset["attempts"]] == [
        "http-error",
        "success",
    ]
    assert dataset["attempts"][1]["sampleSha256"] == (
        "4062edaf750fb8074e7e83e0c9028c94e32468a8b6f1614774328ef045150f93"
    )
    assert "body" not in json.dumps(report)
    document = probe_status_document(report)
    assert "1 of 1 datasets" in document
    assert "310" not in document
    assert "does not grant permission" in document
    assert "package metadata" in document


def test_probe_representatives_marks_legacy_only_dataset_not_probeable() -> None:
    inventory = DataGovResourceInventory(
        schema_version=1,
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        package_endpoint="https://data.gov.hk/en-data/api/3/action/package_show",
        resources=(
            build_resource(
                "dataset-one",
                ("HKAPI-030",),
                {
                    "id": "legacy-resource",
                    "name": "Legacy data",
                    "format": "CSV",
                    "url": "http://example.hk/legacy.csv",
                },
            ),
        ),
    )

    class UnexpectedFetcher:
        def fetch_sample(self, request: ApprovedRequest, *, sample_bytes: int) -> FetchSampleResult:
            raise AssertionError("unsafe resources must not be fetched")

    report = probe_representatives(
        inventory,
        fetcher=UnexpectedFetcher(),
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        inventory_sha256="a" * 64,
    )

    assert report["notProbeable"] == 1
    assert report["datasets"]["dataset-one"]["outcome"] == "not-probeable"


def test_probe_representatives_skips_https_dataset_pages() -> None:
    inventory = DataGovResourceInventory(
        schema_version=1,
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        package_endpoint="https://data.gov.hk/en-data/api/3/action/package_show",
        resources=(
            build_resource(
                "dataset-one",
                ("HKAPI-101",),
                {
                    "id": "landing-page",
                    "name": "Dataset landing page",
                    "format": "JSON",
                    "url": "https://data.gov.hk/en-data/dataset/example",
                },
            ),
        ),
    )

    class UnexpectedFetcher:
        def fetch_sample(self, request: ApprovedRequest, *, sample_bytes: int) -> FetchSampleResult:
            raise AssertionError("dataset pages must not be fetched as provider payloads")

    report = probe_representatives(
        inventory,
        fetcher=UnexpectedFetcher(),
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        inventory_sha256="a" * 64,
    )

    assert report["notProbeable"] == 1
    assert report["datasets"]["dataset-one"]["outcome"] == "not-probeable"
