from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path

import yaml
from hk_data_worker.access.errors import AccessFailure
from hk_data_worker.access.execution import verify_recipe
from hk_data_worker.access.generation import recipe_sha256
from hk_data_worker.access.models import AccessRecipe
from hk_data_worker.access.planning import plan_request
from hk_data_worker.access.registry import RecipeLoader, load_recipes
from hk_data_worker.fetch import SafeFetcher

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
MAPPING_PATH = REPOSITORY_ROOT / "access" / "data-gov-datasets.yml"
RECIPES_ROOT = REPOSITORY_ROOT / "access" / "recipes" / "official"
FIXTURES_ROOT = REPOSITORY_ROOT / "tests" / "fixtures" / "access" / "official"
DATASET_ID = re.compile(r"^[a-z0-9][a-z0-9._-]{2,199}$")

LIMITATIONS = (
    "Technical access example only; review current provider terms, attribution, caching and "
    "redistribution requirements before use.",
    "This recipe resolves official DATA.GOV.HK dataset metadata and current resource URLs; "
    "it does not download the underlying resource files or API responses.",
    "Availability, schema, licensing and permitted use of each linked resource must be checked "
    "against the current provider documentation before use.",
)

SYNTHETIC_RESPONSE = (
    b'{"help":"synthetic fixture","success":true,"result":'
    b'{"id":"dataset-one","title":"Dataset one","resources":'
    b'[{"format":"JSON","name":"Current data",'
    b'"url":"https://example.gov.hk/data.json"}]}}\n'
)


def load_mapping(path: Path = MAPPING_PATH) -> dict[str, tuple[str, ...]]:
    value = yaml.load(path.read_text(encoding="utf-8"), Loader=RecipeLoader)
    if not isinstance(value, dict) or value.get("schemaVersion") != 1:
        raise ValueError("DATA.GOV.HK mapping must use schemaVersion 1")
    sources = value.get("sources")
    if not isinstance(sources, dict):
        raise ValueError("DATA.GOV.HK mapping must contain a sources object")
    result: dict[str, tuple[str, ...]] = {}
    for reference, dataset_ids in sources.items():
        if not isinstance(reference, str) or re.fullmatch(r"HKAPI-[0-9]{3}", reference) is None:
            raise ValueError("DATA.GOV.HK mapping contains an invalid source reference")
        if (
            not isinstance(dataset_ids, list)
            or not dataset_ids
            or not all(isinstance(item, str) and DATASET_ID.fullmatch(item) for item in dataset_ids)
            or len(dataset_ids) != len(set(dataset_ids))
        ):
            raise ValueError(f"{reference} must map to unique DATA.GOV.HK dataset identifiers")
        result[reference] = tuple(dataset_ids)
    return result


def promoted_recipe(
    value: dict[str, object],
    dataset_ids: tuple[str, ...],
    *,
    status: str = "fixture-tested",
) -> AccessRecipe:
    reference = value.get("sourceReference")
    if not isinstance(reference, str):
        raise ValueError("recipe lacks sourceReference")
    first = dataset_ids[0]
    promoted = {
        **value,
        "recipeVersion": "1.1.0",
        "adapter": "data-gov-resource-index",
        "status": status,
        "documentationUrl": f"https://data.gov.hk/en-data/dataset/{first}",
        "limitations": list(LIMITATIONS),
        "authentication": {
            "type": "none",
            "environmentVariables": [],
            "setup": None,
        },
        "request": {
            "method": "GET",
            "urlTemplate": "https://data.gov.hk/en-data/api/3/action/package_show",
            "allowedHosts": ["data.gov.hk"],
            "parameters": [
                {
                    "name": "id",
                    "location": "query",
                    "dataType": "string",
                    "required": True,
                    "default": first,
                    "example": first,
                    "description": (
                        "Reviewed DATA.GOV.HK dataset identifier for this catalogue source."
                    ),
                    "enum": list(dataset_ids),
                    "minimum": None,
                    "maximum": None,
                    "pattern": r"^[a-z0-9][a-z0-9._-]{2,199}$",
                }
            ],
            "headers": [
                {
                    "name": "accept",
                    "value": "application/json",
                    "environmentVariable": None,
                }
            ],
            "bodyTemplate": None,
            "timeoutMs": 15_000,
            "maxResponseBytes": 5 * 1024 * 1024,
            "maxPages": 1,
            "retry": {
                "attempts": 2,
                "statusCodes": [408, 429, 500, 502, 503, 504],
            },
        },
        "response": {
            "mediaTypes": ["application/json"],
            "recordPath": "/result",
            "idPath": "/id",
            "timestampPath": None,
            "pagination": {"strategy": "none", "nextPath": None},
            "normalization": {
                "fields": {},
                "language": None,
                "geometry": None,
                "timestamp": None,
            },
        },
        "reason": None,
        "nextAction": None,
    }
    return AccessRecipe.model_validate(promoted)


def _json_bytes(value: object) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


def generate(
    repository_root: Path = REPOSITORY_ROOT,
    *,
    status: str = "preserve",
) -> int:
    if status not in {"preserve", "fixture-tested", "live-verified"}:
        raise ValueError(
            "resource-index status must be preserve, fixture-tested or live-verified"
        )
    mapping = load_mapping(repository_root / "access" / "data-gov-datasets.yml")
    recipes_root = repository_root / "access" / "recipes" / "official"
    fixtures_root = repository_root / "tests" / "fixtures" / "access" / "official"
    manifest_path = fixtures_root / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    if not isinstance(manifest, dict):
        raise ValueError("official fixture manifest must be an object")

    for reference, dataset_ids in mapping.items():
        recipe_path = recipes_root / f"{reference.lower()}.yml"
        raw = yaml.load(recipe_path.read_text(encoding="utf-8"), Loader=RecipeLoader)
        if not isinstance(raw, dict):
            raise ValueError(f"{reference} recipe must be an object")
        declared_status = status
        if status == "preserve":
            declared_status = (
                "live-verified"
                if raw.get("adapter") == "data-gov-resource-index"
                and raw.get("status") == "live-verified"
                else "fixture-tested"
            )
        recipe = promoted_recipe(raw, dataset_ids, status=declared_status)
        public = recipe.model_dump(mode="json", by_alias=True)
        recipe_path.write_text(
            yaml.safe_dump(public, allow_unicode=True, sort_keys=False, width=100),
            encoding="utf-8",
        )

        fixture_dir = fixtures_root / reference.lower()
        fixture_dir.mkdir(parents=True, exist_ok=True)
        parameters = {"id": dataset_ids[0]}
        planned = plan_request(recipe, parameters, environ={})
        request_fixture = {
            "approvedRequests": [request.model_dump(mode="json") for request in planned],
            "parameters": parameters,
        }
        (fixture_dir / "request.json").write_bytes(_json_bytes(request_fixture))
        (fixture_dir / "response.json").write_bytes(SYNTHETIC_RESPONSE)
        manifest[reference] = {
            "documentationUrl": recipe.documentation_url,
            "mediaType": "application/json",
            "provenance": "synthetic-authored",
            "recipeSha256": recipe_sha256(recipe),
            "requestFixture": f"{reference.lower()}/request.json",
            "responseFixture": f"{reference.lower()}/response.json",
            "responseSha256": sha256(SYNTHETIC_RESPONSE).hexdigest(),
            "sourceReference": reference,
        }

    manifest_path.write_bytes(_json_bytes(dict(sorted(manifest.items()))))
    return len(mapping)


def verify_all_dataset_ids(
    repository_root: Path = REPOSITORY_ROOT,
    *,
    concurrency: int = 1,
    now: datetime | None = None,
) -> dict[str, object]:
    if concurrency < 1 or concurrency > 3:
        raise ValueError("verification concurrency must be between 1 and 3")
    mapping = load_mapping(repository_root / "access" / "data-gov-datasets.yml")
    recipes = {
        recipe.source_reference: recipe
        for recipe in load_recipes(repository_root / "access" / "recipes" / "official")
    }
    references_by_dataset: dict[str, list[str]] = defaultdict(list)
    for reference, dataset_ids in mapping.items():
        for dataset_id in dataset_ids:
            references_by_dataset[dataset_id].append(reference)
    checked_at = now or datetime.now(UTC)

    def attempt(dataset_id: str) -> tuple[str, dict[str, object]]:
        references = sorted(references_by_dataset[dataset_id])
        recipe = recipes[references[0]]
        try:
            evidence = verify_recipe(
                recipe,
                fetcher=SafeFetcher(),
                parameters={"id": dataset_id},
                now=checked_at,
            )
            response = evidence.model_dump(mode="json", by_alias=True)
            for field in (
                "schemaVersion",
                "sourceReference",
                "recipeVersion",
                "recipeSha256",
                "checkedAt",
                "validUntil",
                "limitations",
                "toolVersion",
            ):
                response.pop(field)
            return dataset_id, {
                "sourceReferences": references,
                **response,
            }
        except AccessFailure as error:
            return dataset_id, {
                "sourceReferences": references,
                "outcome": "failure",
                "errorCode": error.code,
            }

    all_dataset_ids = sorted(references_by_dataset)
    if concurrency == 1:
        checked = map(attempt, all_dataset_ids)
        results = dict(checked)
    else:
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            results = dict(executor.map(attempt, all_dataset_ids))
    successes = sum(value["outcome"] == "success" for value in results.values())
    report = {
        "schemaVersion": 1,
        "checkedAt": checked_at.isoformat().replace("+00:00", "Z"),
        "provenance": "live-metadata-only",
        "sourceDirectory": (
            "https://resource.data.one.gov.hk/opendata/open-data-list/"
            "open-data-dataset-list-en.json"
        ),
        "sourceCount": len(mapping),
        "sourceDatasetMappings": sum(len(value) for value in mapping.values()),
        "uniqueDatasetIds": len(all_dataset_ids),
        "successes": successes,
        "failures": len(all_dataset_ids) - successes,
        "datasets": results,
    }
    output = (
        repository_root
        / "access"
        / "verification"
        / "data-gov-datasets"
        / "manifest.json"
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_bytes(_json_bytes(report))
    return report


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Generate reviewed DATA.GOV.HK resource-index recipes and fixtures"
    )
    parser.add_argument(
        "--status",
        choices=("preserve", "fixture-tested", "live-verified"),
        default="preserve",
        help="declared status; effective live status still requires current matching evidence",
    )
    parser.add_argument(
        "--verify-all-datasets",
        action="store_true",
        help="contact DATA.GOV.HK and record metadata-only evidence for every mapped dataset ID",
    )
    parser.add_argument("--concurrency", type=int, choices=(1, 2, 3), default=1)
    args = parser.parse_args(argv)
    if args.verify_all_datasets:
        report = verify_all_dataset_ids(concurrency=args.concurrency)
        print(
            "verified "
            f"{report['successes']} of {report['uniqueDatasetIds']} DATA.GOV.HK dataset IDs"
        )
        return 0 if report["failures"] == 0 else 1
    count = generate(status=args.status)
    print(f"generated {count} DATA.GOV.HK resource-index recipes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
