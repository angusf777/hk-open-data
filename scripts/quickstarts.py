from __future__ import annotations

import argparse
import json
import shlex
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import quote

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
SITE_ROOT = "https://angusf777.github.io/hk-open-data"
OUTPUT_ROOT = REPOSITORY_ROOT / "docs" / "quickstarts"


@dataclass(frozen=True)
class Quickstart:
    slug: str
    title: str
    purpose: str
    source_reference: str
    dataset_id: str | None = None
    resource_id: str | None = None
    output_name: str = "resource.data"


QUICKSTARTS = (
    Quickstart(
        "transport-routes",
        "Public transport routes: New Lantao Bus",
        "Download the current New Lantao Bus route list as JSON.",
        "HKAPI-030",
        "nlb-bus-nlb-bus-service-v2",
        "96c5e827-3d3a-4110-8cd2-e7c80cd562bc",
        "nlb-routes.json",
    ),
    Quickstart(
        "weather-forecast",
        "Weather forecast: Hong Kong Observatory",
        "Request the current Hong Kong local weather forecast as JSON.",
        "HKAPI-087",
        output_name="weather-forecast.json",
    ),
    Quickstart(
        "air-quality",
        "Air quality: current AQHI by station",
        "Download the current station-level Air Quality Health Index feed.",
        "HKAPI-101",
        "hk-epd-airteam-current-aqhi-of-individual-air-quality-monitoring-stations",
        "33a48965-adef-4252-a90c-6e3bf9385aad",
        "current-aqhi.xml",
    ),
    Quickstart(
        "traffic-geospatial",
        "Geospatial data: traffic census cordons",
        "Download Transport Department traffic-census cordon geometry in GML.",
        "HKAPI-067",
        "hk-td-tis_7-traffic-flow-census",
        "01d7163f-4740-4b12-97c0-8ebedcd0b72c",
        "traffic-census-cordons.gml",
    ),
    Quickstart(
        "company-information",
        "Company information: registered place of business",
        "Call the Companies Registry example for a registered non-Hong Kong company.",
        "HKAPI-147",
        "hk-cr-crdata-list-addr",
        "8ee7f555-0f8c-440a-b816-ea58e7a8dc1f",
        "company-place-of-business.json",
    ),
)


def _load(path: Path) -> dict[str, object]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"{path} must contain an object")
    return value


def _provider_document(
    item: Quickstart,
    inventory: dict[str, object],
    evidence: dict[str, object],
) -> str:
    resources = inventory.get("resources")
    datasets = inventory.get("datasets")
    evidence_datasets = evidence.get("datasets")
    if (
        not isinstance(resources, list)
        or not isinstance(datasets, list)
        or not isinstance(evidence_datasets, dict)
    ):
        raise ValueError("provider inventory or evidence has an unsupported shape")
    resource = next(
        (
            value
            for value in resources
            if isinstance(value, dict)
            and value.get("datasetId") == item.dataset_id
            and value.get("resourceId") == item.resource_id
        ),
        None,
    )
    dataset = next(
        (
            value
            for value in datasets
            if isinstance(value, dict) and value.get("datasetId") == item.dataset_id
        ),
        None,
    )
    dataset_evidence = evidence_datasets.get(item.dataset_id)
    if (
        not isinstance(resource, dict)
        or not isinstance(dataset, dict)
        or not isinstance(dataset_evidence, dict)
    ):
        raise ValueError(f"quickstart target is missing: {item.slug}")
    attempts = dataset_evidence.get("attempts")
    attempt = next(
        (
            value
            for value in attempts
            if isinstance(value, dict) and value.get("resourceId") == item.resource_id
        ),
        None,
    ) if isinstance(attempts, list) else None
    if (
        dataset_evidence.get("outcome") != "success"
        or dataset_evidence.get("selectedResourceId") != item.resource_id
        or not isinstance(attempt, dict)
        or attempt.get("outcome") != "success"
        or resource.get("resourceKind") not in {"api", "file"}
    ):
        raise ValueError(f"quickstart target lacks current payload evidence: {item.slug}")
    url = resource.get("urlTemplate")
    if not isinstance(url, str):
        raise ValueError(f"quickstart target URL is invalid: {item.slug}")
    cli = (
        f"uv run --project packages/sdk-python hkdata fetch-resource {item.source_reference} "
        f"{item.resource_id} --dataset {item.dataset_id} --max-bytes 26214400 "
        f"--output {item.output_name}"
    )
    curl = (
        "curl --fail-with-body --max-time 30 --proto '=https' --max-filesize 26214400 "
        "--remove-on-error --no-clobber "
        f"--output {shlex.quote(item.output_name)} {shlex.quote(url)}"
    )
    checked_at = evidence.get("checkedAt")
    dataset_url = f"{SITE_ROOT}/datasets/{quote(str(item.dataset_id), safe='')}/"
    return f"""# {item.title}

{item.purpose}

## Run it

From the repository root:

```bash
{cli}
```

Equivalent bounded cURL request:

```bash
{curl}
```

## What was verified

- Catalogue source: `{item.source_reference}`
- DATA.GOV.HK dataset: [`{item.dataset_id}`]({dataset_url})
- Exact resource: `{item.resource_id}`
- Resource type: `{resource.get('resourceKind')}`; declared format: `{resource.get('format')}`
- Latest bounded attempt: `{checked_at}`; HTTP `{attempt.get('httpStatus')}`;
  media type `{attempt.get('mediaType')}`
- Evidence sample: `{attempt.get('sampleBytes')}` bytes; SHA-256 `{attempt.get('sampleSha256')}`

The check read only a bounded sample. It proves that this exact URL returned a non-empty successful
response at the recorded time; it does not guarantee later availability, completeness, or fitness.

## Before using the data

Review the provider's current dataset and platform terms before commercial use, caching, scraping,
or redistribution. This technical example does not grant rights in provider data.
"""


def _recipe_document(item: Quickstart, catalogue: dict[str, object]) -> str:
    resources = catalogue.get("resources")
    if not isinstance(resources, list):
        raise ValueError("catalogue resources are missing")
    source = next(
        (
            value
            for value in resources
            if isinstance(value, dict) and value.get("sourceReference") == item.source_reference
        ),
        None,
    )
    recipe = source.get("accessRecipe") if isinstance(source, dict) else None
    verification = recipe.get("verification") if isinstance(recipe, dict) else None
    examples = recipe.get("examples") if isinstance(recipe, dict) else None
    if (
        not isinstance(source, dict)
        or not isinstance(recipe, dict)
        or recipe.get("effectiveStatus") != "live-verified"
        or not isinstance(verification, dict)
        or verification.get("outcome") != "success"
        or not isinstance(examples, dict)
        or not isinstance(examples.get("curl"), str)
    ):
        raise ValueError(f"quickstart recipe lacks current live evidence: {item.slug}")
    command = examples["curl"].rstrip()
    source_id = source.get("id")
    source_url = f"{SITE_ROOT}/resources/{quote(str(source_id), safe='')}/"
    return f"""# {item.title}

{item.purpose}

## Run it

```bash
{command}
```

To save the response, add `--output {item.output_name}` to the cURL command.

## What was verified

- Catalogue source: [`{item.source_reference}`]({source_url})
- Recipe version: `{recipe.get('recipeVersion')}`
- Latest bounded verification: `{verification.get('checkedAt')}`;
  valid until `{verification.get('validUntil')}`
- Observed response: HTTP `{verification.get('httpStatus')}`;
  media type `{verification.get('mediaType')}`; `{verification.get('responseBytes')}` bytes
- Response SHA-256: `{verification.get('responseSha256')}`

The verification is dated evidence, not an uptime promise. Re-run
`hkdata verify {item.source_reference}` if the validity date has passed.

## Before using the data

Review the provider's current terms before commercial use, caching, scraping, or redistribution.
This technical example does not grant rights in provider data.
"""


def render_documents(repository_root: Path = REPOSITORY_ROOT) -> dict[str, str]:
    inventory = _load(repository_root / "access/generated/data-gov-resources.json")
    evidence = _load(repository_root / "access/verification/data-gov-resources/manifest.json")
    catalogue = _load(repository_root / "catalog/generated/catalogue.json")
    documents: dict[str, str] = {}
    for item in QUICKSTARTS:
        documents[f"{item.slug}.md"] = (
            _provider_document(item, inventory, evidence)
            if item.dataset_id and item.resource_id
            else _recipe_document(item, catalogue)
        )
    links = "\n".join(
        f"- [{item.title}]({item.slug}.md) — {item.purpose}" for item in QUICKSTARTS
    )
    documents["README.md"] = f"""# Tested quickstarts

These guides turn five useful Hong Kong public-data tasks into copyable commands backed by the
repository's current bounded verification evidence.

{links}

Verification is point-in-time technical evidence, not a provider endorsement, permission decision,
or guarantee. Check each guide's evidence date and the provider's current terms before use.
"""
    return documents


def write_documents(repository_root: Path = REPOSITORY_ROOT) -> None:
    output_root = repository_root / "docs/quickstarts"
    output_root.mkdir(parents=True, exist_ok=True)
    for name, content in render_documents(repository_root).items():
        (output_root / name).write_text(content, encoding="utf-8")


def check_documents(repository_root: Path = REPOSITORY_ROOT) -> None:
    for name, expected in render_documents(repository_root).items():
        path = repository_root / "docs/quickstarts" / name
        if not path.exists() or path.read_text(encoding="utf-8") != expected:
            relative = path.relative_to(repository_root)
            raise ValueError(f"generated quickstart has drifted: {relative}")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Generate evidence-backed public-data quickstarts")
    parser.add_argument("command", choices=("generate", "check"))
    args = parser.parse_args(argv)
    if args.command == "generate":
        write_documents()
        print(f"generated {len(QUICKSTARTS)} tested quickstarts")
    else:
        check_documents()
        print(f"checked {len(QUICKSTARTS)} tested quickstarts")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
