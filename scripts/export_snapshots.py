from __future__ import annotations

import argparse
import csv
import json
import shutil
import sqlite3
from hashlib import sha256
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_NAMES = (
    "README.txt",
    "catalogue.json",
    "datasets.csv",
    "hk-open-data.sqlite",
    "provider-resources.csv",
    "provider-resources.json",
    "sources.csv",
)


def _load(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain an object")
    return value


def public_provider_inventory(
    inventory: dict[str, object], evidence: dict[str, object]
) -> dict[str, object]:
    resources = inventory.get("resources")
    evidence_datasets = evidence.get("datasets")
    if not isinstance(resources, list) or not isinstance(evidence_datasets, dict):
        raise ValueError("provider inventory or evidence has an unsupported shape")
    public_resources: list[dict[str, object]] = []
    for value in resources:
        if not isinstance(value, dict):
            raise ValueError("provider resource must be an object")
        dataset_id = value.get("datasetId")
        resource_id = value.get("resourceId")
        dataset_evidence = evidence_datasets.get(dataset_id)
        attempts = dataset_evidence.get("attempts") if isinstance(dataset_evidence, dict) else None
        attempt = (
            next(
                (
                    candidate
                    for candidate in attempts
                    if isinstance(candidate, dict) and candidate.get("resourceId") == resource_id
                ),
                None,
            )
            if isinstance(attempts, list)
            else None
        )
        verified = (
            isinstance(dataset_evidence, dict)
            and dataset_evidence.get("outcome") == "success"
            and dataset_evidence.get("selectedResourceId") == resource_id
            and isinstance(attempt, dict)
            and attempt.get("outcome") == "success"
        )
        verification_status = (
            "live-verified" if verified else "failed" if attempt else "metadata-only"
        )
        public_resources.append(
            {
                **value,
                "verification": {
                    "status": verification_status,
                    "checkedAt": (
                        evidence.get("checkedAt") if attempt else inventory.get("checkedAt")
                    ),
                    "datasetOutcome": (
                        dataset_evidence.get("outcome")
                        if isinstance(dataset_evidence, dict)
                        else "unknown"
                    ),
                    "httpStatus": attempt.get("httpStatus") if isinstance(attempt, dict) else None,
                    "mediaType": attempt.get("mediaType") if isinstance(attempt, dict) else None,
                    "sampleBytes": (
                        attempt.get("sampleBytes") if isinstance(attempt, dict) else None
                    ),
                    "elapsedMs": attempt.get("elapsedMs") if isinstance(attempt, dict) else None,
                    "errorCode": attempt.get("errorCode") if isinstance(attempt, dict) else None,
                },
            }
        )
    return {**inventory, "resources": public_resources}


def _json_text(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"), sort_keys=True)


def _write_csv(path: Path, fieldnames: tuple[str, ...], rows: list[dict[str, object]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)


def _source_rows(catalogue: dict[str, object]) -> list[dict[str, object]]:
    resources = catalogue.get("resources")
    if not isinstance(resources, list):
        raise ValueError("catalogue resources are missing")
    rows = []
    for resource in resources:
        if not isinstance(resource, dict):
            raise ValueError("catalogue source must be an object")
        name = resource.get("name")
        provider = resource.get("provider")
        provider_name = provider.get("name") if isinstance(provider, dict) else None
        urls = resource.get("urls")
        verification = resource.get("verification")
        terms = resource.get("termsEvidence")
        rows.append(
            {
                "id": resource.get("id"),
                "source_reference": resource.get("sourceReference"),
                "type": resource.get("type"),
                "name_en": name.get("en") if isinstance(name, dict) else None,
                "name_zh_hant": name.get("zh-Hant") if isinstance(name, dict) else None,
                "provider_en": (
                    provider_name.get("en") if isinstance(provider_name, dict) else None
                ),
                "categories": _json_text(resource.get("categories", [])),
                "protocols": _json_text(resource.get("protocols", [])),
                "formats": _json_text(resource.get("formats", [])),
                "authentication": resource.get("authentication"),
                "access": resource.get("access"),
                "verification_status": (
                    verification.get("status") if isinstance(verification, dict) else None
                ),
                "checked_at": (
                    verification.get("checkedAt") if isinstance(verification, dict) else None
                ),
                "landing_url": urls.get("landing") if isinstance(urls, dict) else None,
                "documentation_url": (
                    urls.get("documentation") if isinstance(urls, dict) else None
                ),
                "terms_url": urls.get("terms") if isinstance(urls, dict) else None,
                "terms_state": terms.get("state") if isinstance(terms, dict) else None,
                "terms_checked_at": (terms.get("checkedAt") if isinstance(terms, dict) else None),
            }
        )
    return rows


def _dataset_rows(public_inventory: dict[str, object]) -> list[dict[str, object]]:
    datasets = public_inventory.get("datasets")
    if not isinstance(datasets, list):
        raise ValueError("provider datasets are missing")
    return [
        {
            "dataset_id": value.get("datasetId"),
            "title": value.get("title"),
            "description": value.get("description"),
            "provider_name": value.get("providerName"),
            "source_references": _json_text(value.get("sourceReferences", [])),
            "landing_url": value.get("landingUrl"),
            "modified_at": value.get("modifiedAt"),
            "resource_count": value.get("resourceCount"),
            "formats": _json_text(value.get("formats", [])),
        }
        for value in datasets
        if isinstance(value, dict)
    ]


def _provider_rows(public_inventory: dict[str, object]) -> list[dict[str, object]]:
    resources = public_inventory.get("resources")
    if not isinstance(resources, list):
        raise ValueError("provider resources are missing")
    rows = []
    for value in resources:
        if not isinstance(value, dict):
            continue
        verification = value.get("verification")
        rows.append(
            {
                "dataset_id": value.get("datasetId"),
                "resource_id": value.get("resourceId"),
                "name": value.get("name"),
                "source_references": _json_text(value.get("sourceReferences", [])),
                "format": value.get("format"),
                "resource_kind": value.get("resourceKind"),
                "transport": value.get("transport"),
                "url_status": value.get("access"),
                "url_template": value.get("urlTemplate"),
                "template_parameters": _json_text(value.get("templateParameters", [])),
                "verification_status": (
                    verification.get("status") if isinstance(verification, dict) else None
                ),
                "evidence_checked_at": (
                    verification.get("checkedAt") if isinstance(verification, dict) else None
                ),
                "dataset_probe_outcome": (
                    verification.get("datasetOutcome") if isinstance(verification, dict) else None
                ),
                "http_status": (
                    verification.get("httpStatus") if isinstance(verification, dict) else None
                ),
                "media_type": (
                    verification.get("mediaType") if isinstance(verification, dict) else None
                ),
                "sample_bytes": (
                    verification.get("sampleBytes") if isinstance(verification, dict) else None
                ),
                "elapsed_ms": (
                    verification.get("elapsedMs") if isinstance(verification, dict) else None
                ),
                "error_code": (
                    verification.get("errorCode") if isinstance(verification, dict) else None
                ),
            }
        )
    return rows


def _write_sqlite(
    path: Path,
    metadata: list[tuple[str, str]],
    source_rows: list[dict[str, object]],
    dataset_rows: list[dict[str, object]],
    provider_rows: list[dict[str, object]],
) -> None:
    path.unlink(missing_ok=True)
    with sqlite3.connect(path) as database:
        database.executescript(
            """
            PRAGMA application_id = 1212895044;
            PRAGMA user_version = 1;
            CREATE TABLE metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL);
            CREATE TABLE catalogue_sources (
              id TEXT PRIMARY KEY, source_reference TEXT NOT NULL, type TEXT NOT NULL,
              name_en TEXT NOT NULL, name_zh_hant TEXT NOT NULL, provider_en TEXT,
              categories TEXT NOT NULL, protocols TEXT NOT NULL, formats TEXT NOT NULL,
              authentication TEXT, access TEXT, verification_status TEXT, checked_at TEXT,
              landing_url TEXT, documentation_url TEXT, terms_url TEXT,
              terms_state TEXT, terms_checked_at TEXT
            );
            CREATE TABLE datasets (
              dataset_id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
              provider_name TEXT, source_references TEXT NOT NULL, landing_url TEXT NOT NULL,
              modified_at TEXT, resource_count INTEGER NOT NULL, formats TEXT NOT NULL
            );
            CREATE TABLE provider_resources (
              dataset_id TEXT NOT NULL, resource_id TEXT NOT NULL, name TEXT NOT NULL,
              source_references TEXT NOT NULL, format TEXT NOT NULL, resource_kind TEXT NOT NULL,
              transport TEXT NOT NULL, url_status TEXT NOT NULL, url_template TEXT NOT NULL,
              template_parameters TEXT NOT NULL, verification_status TEXT NOT NULL,
              evidence_checked_at TEXT, dataset_probe_outcome TEXT, http_status INTEGER,
              media_type TEXT, sample_bytes INTEGER, elapsed_ms INTEGER, error_code TEXT,
              PRIMARY KEY (dataset_id, resource_id)
            );
            CREATE INDEX provider_resources_source ON provider_resources(source_references);
            CREATE INDEX provider_resources_verification ON provider_resources(verification_status);
            """
        )
        database.executemany("INSERT INTO metadata VALUES (?, ?)", metadata)
        for table, rows in (
            ("catalogue_sources", source_rows),
            ("datasets", dataset_rows),
            ("provider_resources", provider_rows),
        ):
            if not rows:
                continue
            columns = tuple(rows[0])
            placeholders = ",".join("?" for _ in columns)
            database.executemany(
                f"INSERT INTO {table} ({','.join(columns)}) VALUES ({placeholders})",
                ([row[column] for column in columns] for row in rows),
            )
        database.commit()
        database.execute("VACUUM")


def generate_snapshots(
    output_root: Path,
    repository_root: Path = REPOSITORY_ROOT,
) -> None:
    catalogue_path = repository_root / "catalog/generated/catalogue.json"
    inventory_path = repository_root / "access/generated/data-gov-resources.json"
    evidence_path = repository_root / "access/verification/data-gov-resources/manifest.json"
    catalogue = _load(catalogue_path)
    inventory = _load(inventory_path)
    evidence = _load(evidence_path)
    if evidence.get("inventorySha256") != sha256(inventory_path.read_bytes()).hexdigest():
        raise ValueError("provider-resource evidence does not match the current inventory")
    public_inventory = public_provider_inventory(inventory, evidence)
    output_root.mkdir(parents=True, exist_ok=True)
    for name in (*OUTPUT_NAMES, "SHA256SUMS"):
        (output_root / name).unlink(missing_ok=True)
    shutil.copyfile(catalogue_path, output_root / "catalogue.json")
    (output_root / "provider-resources.json").write_text(
        json.dumps(public_inventory, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    source_rows = _source_rows(catalogue)
    dataset_rows = _dataset_rows(public_inventory)
    provider_rows = _provider_rows(public_inventory)
    source_fields = tuple(source_rows[0])
    dataset_fields = tuple(dataset_rows[0])
    provider_fields = tuple(provider_rows[0])
    _write_csv(output_root / "sources.csv", source_fields, source_rows)
    _write_csv(output_root / "datasets.csv", dataset_fields, dataset_rows)
    _write_csv(output_root / "provider-resources.csv", provider_fields, provider_rows)
    package = _load(repository_root / "package.json")
    metadata = [
        ("schema_version", "1"),
        ("project_version", str(package.get("version"))),
        ("catalogue_checked_at", str(inventory.get("checkedAt"))),
        ("provider_evidence_checked_at", str(evidence.get("checkedAt"))),
        ("content_boundary", "metadata and technical evidence only; no provider payloads"),
    ]
    _write_sqlite(
        output_root / "hk-open-data.sqlite",
        metadata,
        source_rows,
        dataset_rows,
        provider_rows,
    )
    (output_root / "README.txt").write_text(
        "HK Open Data metadata snapshots\n\n"
        "These files contain project-authored catalogue metadata, provider URLs, and bounded "
        "technical evidence. They do not contain provider dataset payloads. Inclusion and "
        "technical reachability do not grant permission for commercial use, caching, scraping, "
        "or redistribution. Check the provider's current terms before use.\n",
        encoding="utf-8",
    )
    checksum_lines = []
    for name in sorted(OUTPUT_NAMES):
        digest = sha256((output_root / name).read_bytes()).hexdigest()
        checksum_lines.append(f"{digest}  {name}")
    (output_root / "SHA256SUMS").write_text("\n".join(checksum_lines) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate public metadata snapshots")
    parser.add_argument("output", type=Path)
    args = parser.parse_args(argv)
    generate_snapshots(args.output)
    print(f"generated metadata snapshots in {args.output}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
