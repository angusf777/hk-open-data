from __future__ import annotations

import argparse
import json
import os
import tempfile
from collections import defaultdict
from collections.abc import Mapping, Sequence
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Protocol
from urllib.parse import urlencode, urlsplit

from hk_data_worker.access.resources import (
    DataGovResource,
    DataGovResourceInventory,
    build_resource,
    rank_resources,
    resource_request,
)
from hk_data_worker.fetch import FetchError, FetchSampleResult, SafeFetcher
from hk_data_worker.models import ApprovedRequest, FetchResult

from scripts.data_gov_recipes import load_mapping

PACKAGE_ENDPOINT = "https://data.gov.hk/en-data/api/3/action/package_show"
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
INVENTORY_PATH = REPOSITORY_ROOT / "access" / "generated" / "data-gov-resources.json"
PROBE_PATH = REPOSITORY_ROOT / "access" / "verification" / "data-gov-resources" / "manifest.json"


class Fetcher(Protocol):
    def fetch(self, request: ApprovedRequest) -> FetchResult: ...


class SampleFetcher(Protocol):
    def fetch_sample(self, request: ApprovedRequest, *, sample_bytes: int) -> FetchSampleResult: ...


def fetch_packages(
    mapping: Mapping[str, Sequence[str]],
    *,
    fetcher: Fetcher,
    concurrency: int = 1,
) -> dict[str, Mapping[str, object]]:
    if not 1 <= concurrency <= 3:
        raise ValueError("package fetch concurrency must be between 1 and 3")
    dataset_ids = sorted(
        {dataset_id for dataset_ids in mapping.values() for dataset_id in dataset_ids}
    )

    def fetch_one(dataset_id: str) -> tuple[str, Mapping[str, object]]:
        url = f"{PACKAGE_ENDPOINT}?{urlencode({'id': dataset_id})}"
        request = ApprovedRequest(
            method="GET",
            url=url,
            allowed_hosts=("data.gov.hk",),
            timeout_ms=15_000,
            max_response_bytes=5 * 1024 * 1024,
            max_compressed_response_bytes=5 * 1024 * 1024,
            max_attempts=2,
            allowed_media_types=("application/json",),
            headers={"accept": "application/json"},
        )
        response = fetcher.fetch(request)
        try:
            value = json.loads(response.body)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise ValueError(f"DATA.GOV.HK package {dataset_id} returned invalid JSON") from error
        if (
            not 200 <= response.status_code < 300
            or not isinstance(value, dict)
            or value.get("success") is not True
            or not isinstance(value.get("result"), dict)
        ):
            raise ValueError(f"DATA.GOV.HK package fetch failed: {dataset_id}")
        result = value["result"]
        assert isinstance(result, dict)
        return dataset_id, result

    if concurrency == 1:
        return dict(map(fetch_one, dataset_ids))
    with ThreadPoolExecutor(max_workers=concurrency) as executor:
        return dict(executor.map(fetch_one, dataset_ids))


def inventory_from_packages(
    mapping: Mapping[str, Sequence[str]],
    packages: Mapping[str, Mapping[str, object]],
    *,
    checked_at: datetime,
) -> DataGovResourceInventory:
    references_by_dataset: dict[str, list[str]] = defaultdict(list)
    for source_reference, dataset_ids in mapping.items():
        for dataset_id in dataset_ids:
            references_by_dataset[dataset_id].append(source_reference)

    resources = []
    for dataset_id, source_references in sorted(references_by_dataset.items()):
        package = packages.get(dataset_id)
        if package is None:
            raise ValueError(f"missing DATA.GOV.HK package: {dataset_id}")
        if package.get("id") != dataset_id and package.get("name") != dataset_id:
            raise ValueError(f"DATA.GOV.HK package id does not match {dataset_id}")
        raw_resources = package.get("resources")
        if not isinstance(raw_resources, list):
            raise ValueError(f"DATA.GOV.HK package {dataset_id} lacks a resources list")
        for raw in raw_resources:
            if not isinstance(raw, dict):
                raise ValueError(f"DATA.GOV.HK package {dataset_id} has an invalid resource")
            resources.append(build_resource(dataset_id, source_references, raw))

    return DataGovResourceInventory(
        schema_version=1,
        checked_at=checked_at,
        package_endpoint=PACKAGE_ENDPOINT,
        resources=tuple(
            sorted(
                resources,
                key=lambda item: (
                    item.dataset_id,
                    item.resource_id,
                    item.url_template,
                ),
            )
        ),
    )


def inventory_summary(inventory: DataGovResourceInventory) -> dict[str, int]:
    counts = {
        "ready": 0,
        "parameters-required": 0,
        "insecure-http": 0,
        "invalid-url": 0,
    }
    for resource in inventory.resources:
        counts[resource.access] += 1
    return {
        "datasets": len({resource.dataset_id for resource in inventory.resources}),
        "resources": len(inventory.resources),
        **counts,
    }


def probe_representatives(
    inventory: DataGovResourceInventory,
    *,
    fetcher: SampleFetcher,
    checked_at: datetime,
    inventory_sha256: str,
    sample_bytes: int = 4_096,
    max_candidates: int = 3,
    concurrency: int = 1,
) -> dict[str, object]:
    if not 1 <= sample_bytes <= 64 * 1024:
        raise ValueError("sample byte limit must be between 1 and 65536")
    if not 1 <= max_candidates <= 5:
        raise ValueError("maximum probe candidates must be between 1 and 5")
    if not 1 <= concurrency <= 3:
        raise ValueError("resource probe concurrency must be between 1 and 3")

    resources_by_dataset: dict[str, list[DataGovResource]] = defaultdict(list)
    for resource in inventory.resources:
        resources_by_dataset[resource.dataset_id].append(resource)

    def probe_one(dataset_id: str) -> tuple[str, dict[str, object]]:
        resources = resources_by_dataset[dataset_id]
        source_references = sorted(
            {reference for resource in resources for reference in resource.source_references}
        )
        access_counts = {
            status: sum(resource.access == status for resource in resources)
            for status in (
                "ready",
                "parameters-required",
                "insecure-http",
                "invalid-url",
            )
        }
        candidates = [
            resource for resource in rank_resources(resources) if resource.access == "ready"
        ]
        if not candidates:
            return dataset_id, {
                "sourceReferences": source_references,
                "outcome": "not-probeable",
                "reason": "no-parameter-free-https-resource",
                "totalResources": len(resources),
                "accessCounts": access_counts,
                "attempts": [],
                "selectedResourceId": None,
            }

        attempts: list[dict[str, object]] = []
        for resource in candidates[:max_candidates]:
            request = resource_request(
                resource,
                {},
                max_bytes=max(sample_bytes, 1024 * 1024),
            )
            try:
                response = fetcher.fetch_sample(request, sample_bytes=sample_bytes)
            except FetchError as error:
                attempts.append(
                    {
                        "resourceId": resource.resource_id,
                        "format": resource.format,
                        "outcome": "fetch-error",
                        "errorCode": type(error).__name__,
                    }
                )
                continue
            content_type = response.headers.get("content-type")
            media_type = (
                None if content_type is None else content_type.partition(";")[0].strip().lower()
            )
            base_attempt: dict[str, object] = {
                "resourceId": resource.resource_id,
                "format": resource.format,
                "httpStatus": response.status_code,
                "finalHost": urlsplit(response.final_url).hostname,
                "mediaType": media_type,
                "sampleBytes": len(response.body),
                "elapsedMs": response.elapsed_ms,
                "truncated": response.truncated,
            }
            if not 200 <= response.status_code < 300:
                attempts.append({**base_attempt, "outcome": "http-error"})
                continue
            if not response.body:
                attempts.append({**base_attempt, "outcome": "empty-response"})
                continue
            attempts.append(
                {
                    **base_attempt,
                    "outcome": "success",
                    "sampleSha256": sha256(response.body).hexdigest(),
                }
            )
            return dataset_id, {
                "sourceReferences": source_references,
                "outcome": "success",
                "reason": None,
                "totalResources": len(resources),
                "accessCounts": access_counts,
                "attempts": attempts,
                "selectedResourceId": resource.resource_id,
            }
        return dataset_id, {
            "sourceReferences": source_references,
            "outcome": "failure",
            "reason": "bounded-candidates-exhausted",
            "totalResources": len(resources),
            "accessCounts": access_counts,
            "attempts": attempts,
            "selectedResourceId": None,
        }

    dataset_ids = sorted(resources_by_dataset)
    if concurrency == 1:
        datasets = dict(map(probe_one, dataset_ids))
    else:
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            datasets = dict(executor.map(probe_one, dataset_ids))
    successes = sum(result["outcome"] == "success" for result in datasets.values())
    failures = sum(result["outcome"] == "failure" for result in datasets.values())
    not_probeable = sum(result["outcome"] == "not-probeable" for result in datasets.values())
    return {
        "schemaVersion": 1,
        "checkedAt": checked_at.isoformat().replace("+00:00", "Z"),
        "provenance": "live-bounded-payload-samples",
        "inventorySha256": inventory_sha256,
        "sampleLimitBytes": sample_bytes,
        "maxCandidatesPerDataset": max_candidates,
        "uniqueDatasets": len(dataset_ids),
        "successes": successes,
        "failures": failures,
        "notProbeable": not_probeable,
        "datasets": datasets,
    }


def probe_status_document(report: Mapping[str, object]) -> str:
    raw_datasets = report.get("datasets")
    if not isinstance(raw_datasets, dict):
        raise ValueError("resource probe report lacks datasets")

    rows: list[str] = []
    for dataset_id, raw_result in sorted(raw_datasets.items()):
        if not isinstance(dataset_id, str) or not isinstance(raw_result, dict):
            raise ValueError("resource probe report contains an invalid dataset result")
        outcome = raw_result.get("outcome")
        if outcome == "success":
            continue
        references = raw_result.get("sourceReferences")
        source_text = (
            ", ".join(str(value) for value in references)
            if isinstance(references, list)
            else "unknown"
        )
        if outcome == "not-probeable":
            counts = raw_result.get("accessCounts")
            count_text = "no parameter-free HTTPS resource"
            if isinstance(counts, dict):
                count_text += (
                    f"; parameterized={counts.get('parameters-required', 0)}, "
                    f"HTTP-only={counts.get('insecure-http', 0)}"
                )
            detail = count_text
        else:
            attempts = raw_result.get("attempts")
            attempt_text: list[str] = []
            if isinstance(attempts, list):
                for attempt in attempts:
                    if not isinstance(attempt, dict):
                        continue
                    result = attempt.get("outcome", "unknown")
                    status = attempt.get("httpStatus")
                    error = attempt.get("errorCode")
                    suffix = f"HTTP {status}" if status is not None else str(error or result)
                    attempt_text.append(f"{attempt.get('resourceId', 'unknown')}: {suffix}")
            detail = "; ".join(attempt_text) or "bounded candidates exhausted"
        rows.append(f"| `{dataset_id}` | {source_text} | {outcome} | {detail} |")

    return "\n".join(
        [
            "# DATA.GOV.HK provider-resource verification",
            "",
            f"**Checked:** {report.get('checkedAt', 'unknown')}",
            "",
            (
                f"A bounded live run sampled one usable provider resource for "
                f"**{report.get('successes', 0)} of {report.get('uniqueDatasets', 0)} datasets**. "
                f"It recorded **{report.get('failures', 0)} current failures** and "
                f"**{report.get('notProbeable', 0)} datasets without a parameter-free HTTPS "
                "candidate**."
            ),
            "",
            (
                "Each successful check received a non-empty 2xx response while reading at most "
                f"{report.get('sampleLimitBytes', 0)} bytes. The runner tried at most "
                f"{report.get('maxCandidatesPerDataset', 0)} ranked resources per dataset. "
                "It stored status, host, media type, timing, size and SHA-256 only; provider "
                "response bodies are not committed. This is representative dataset coverage, "
                "not a claim that every listed resource URL was downloaded."
            ),
            "",
            (
                "Package metadata resolution and downstream payload access are separate checks. "
                "The inventory proves that DATA.GOV.HK package metadata resolved; only a "
                "successful dataset row in this report proves a bounded provider payload read."
            ),
            "",
            (
                "The automatic run does not invent values for parameterized URLs. Separately "
                "documented parameter checks cover the airport, Sun Ferry and NLB examples; "
                "the two Water Taxi/Fortune Ferry examples currently return HTTP 403 from the "
                "verification host. See the usage guide for exact commands and values."
            ),
            "",
            (
                "Technical success or inclusion does not grant permission for commercial use, "
                "caching, scraping or redistribution. Provider terms and applicable law remain "
                "controlling. Availability can change after the recorded check."
            ),
            "",
            (
                "- [Machine-readable resource inventory]"
                "(../../access/generated/data-gov-resources.json)"
            ),
            (
                "- [Machine-readable probe evidence]"
                "(../../access/verification/data-gov-resources/manifest.json)"
            ),
            "- [Usage guide](../getting-started/access-recipes.md)",
            "",
            "## Exact exceptions",
            "",
            "| Dataset | Catalogue sources | Outcome | Recorded detail |",
            "| --- | --- | --- | --- |",
            *rows,
            "",
        ]
    )


def _write_json_atomic(path: Path, value: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (
        json.dumps(
            value,
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    ).encode()
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.", suffix=".tmp", dir=path.parent
    )
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)
        directory_descriptor = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    except BaseException:
        try:
            os.close(descriptor)
        except OSError:
            pass
        temporary.unlink(missing_ok=True)
        raise


def write_inventory_atomic(path: Path, inventory: DataGovResourceInventory) -> None:
    value = inventory.model_dump(mode="json", by_alias=True)
    DataGovResourceInventory.model_validate(value)
    _write_json_atomic(path, value)


def validate_inventory(
    inventory: DataGovResourceInventory,
    mapping: Mapping[str, Sequence[str]],
) -> None:
    expected: dict[str, set[str]] = defaultdict(set)
    for source_reference, dataset_ids in mapping.items():
        for dataset_id in dataset_ids:
            expected[dataset_id].add(source_reference)
    actual: dict[str, set[str]] = defaultdict(set)
    for resource in inventory.resources:
        actual[resource.dataset_id].update(resource.source_references)
    if set(actual) != set(expected):
        raise ValueError("DATA.GOV.HK resource inventory dataset mapping has drifted")
    for dataset_id in sorted(expected):
        if actual[dataset_id] != expected[dataset_id]:
            raise ValueError(f"DATA.GOV.HK resource inventory references drifted: {dataset_id}")


def refresh_inventory(
    repository_root: Path = REPOSITORY_ROOT,
    *,
    fetcher: Fetcher | None = None,
    concurrency: int = 1,
    checked_at: datetime | None = None,
) -> DataGovResourceInventory:
    mapping = load_mapping(repository_root / "access" / "data-gov-datasets.yml")
    packages = fetch_packages(
        mapping,
        fetcher=fetcher or SafeFetcher(),
        concurrency=concurrency,
    )
    inventory = inventory_from_packages(
        mapping,
        packages,
        checked_at=checked_at or datetime.now(UTC),
    )
    write_inventory_atomic(
        repository_root / "access" / "generated" / "data-gov-resources.json",
        inventory,
    )
    return inventory


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Refresh and validate the mapped DATA.GOV.HK provider-resource inventory"
    )
    parser.add_argument("command", choices=("refresh", "probe", "document", "check", "summary"))
    parser.add_argument("--concurrency", type=int, choices=(1, 2, 3), default=1)
    parser.add_argument("--sample-bytes", type=int, default=4_096)
    parser.add_argument("--max-candidates", type=int, choices=(1, 2, 3, 4, 5), default=3)
    args = parser.parse_args(argv)

    if args.command == "refresh":
        inventory = refresh_inventory(concurrency=args.concurrency)
    else:
        inventory_bytes = INVENTORY_PATH.read_bytes()
        inventory = DataGovResourceInventory.model_validate_json(inventory_bytes)
        if args.command == "probe":
            report = probe_representatives(
                inventory,
                fetcher=SafeFetcher(),
                checked_at=datetime.now(UTC),
                inventory_sha256=sha256(inventory_bytes).hexdigest(),
                sample_bytes=args.sample_bytes,
                max_candidates=args.max_candidates,
                concurrency=args.concurrency,
            )
            _write_json_atomic(PROBE_PATH, report)
            status_path = REPOSITORY_ROOT / "docs" / "access" / "provider-resources.md"
            status_path.write_text(probe_status_document(report), encoding="utf-8")
            print(
                json.dumps(
                    {
                        key: report[key]
                        for key in (
                            "uniqueDatasets",
                            "successes",
                            "failures",
                            "notProbeable",
                        )
                    },
                    sort_keys=True,
                )
            )
            return 0 if report["failures"] == 0 else 1
        if args.command == "document":
            report = json.loads(PROBE_PATH.read_text(encoding="utf-8"))
            if not isinstance(report, dict):
                raise ValueError("resource probe report must be an object")
            status_path = REPOSITORY_ROOT / "docs" / "access" / "provider-resources.md"
            status_path.write_text(probe_status_document(report), encoding="utf-8")
            print(f"generated {status_path.relative_to(REPOSITORY_ROOT)}")
            return 0
        if args.command == "check":
            validate_inventory(inventory, load_mapping())
            report = json.loads(PROBE_PATH.read_text(encoding="utf-8"))
            if not isinstance(report, dict):
                raise ValueError("resource probe report must be an object")
            if report.get("inventorySha256") != sha256(inventory_bytes).hexdigest():
                raise ValueError("resource probe evidence does not match the current inventory")
            status_path = REPOSITORY_ROOT / "docs" / "access" / "provider-resources.md"
            if status_path.read_text(encoding="utf-8") != probe_status_document(report):
                raise ValueError("generated provider-resource status document has drifted")
    summary = inventory_summary(inventory)
    print(json.dumps(summary, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
