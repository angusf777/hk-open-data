from __future__ import annotations

import argparse
import copy
import json
import sys
import tempfile
from collections import Counter
from pathlib import Path
from typing import Any

import jsonschema
import yaml
from jsonschema import Draft202012Validator, FormatChecker

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
SCHEMA_PATH = REPOSITORY_ROOT / "catalog" / "schemas" / "resource.schema.json"
ACCESS_INDEX_PATH = REPOSITORY_ROOT / "access" / "generated" / "recipes.json"
CATALOGUE_ROOT = REPOSITORY_ROOT / "catalog"
GENERATED_ROOT = CATALOGUE_ROOT / "generated"
RESOURCE_TYPES = ("external", "mcp", "official")
OUTPUT_NAMES = (
    "access-recipes.json",
    "catalogue.json",
    "counts.json",
    "external.json",
    "mcp.json",
    "official.json",
    "search-index.json",
    "stale.json",
)


class MetadataLoader(yaml.SafeLoader):
    """Safe YAML loader that preserves ISO dates as catalogue strings."""


MetadataLoader.yaml_implicit_resolvers = {
    key: [(tag, pattern) for tag, pattern in resolvers if tag != "tag:yaml.org,2002:timestamp"]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}


def _validator() -> Draft202012Validator:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    return Draft202012Validator(schema, format_checker=FormatChecker())


def _record_paths(root: Path) -> list[Path]:
    typed = [root / resource_type for resource_type in RESOURCE_TYPES]
    if root.resolve() == CATALOGUE_ROOT.resolve() or any(path.is_dir() for path in typed):
        return sorted(path for directory in typed for path in directory.glob("*.yml"))
    return sorted(root.rglob("*.yml"))


def load_records(root: Path) -> list[dict[str, Any]]:
    records: list[dict[str, Any]] = []
    for path in _record_paths(root):
        value = yaml.load(path.read_text(encoding="utf-8"), Loader=MetadataLoader)
        if not isinstance(value, dict):
            value = {"_invalid": value}
        records.append({"_path": str(path), **value})
    return records


def load_access_index(path: Path = ACCESS_INDEX_PATH) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or value.get("schemaVersion") != 1:
        raise ValueError(f"invalid access recipe index: {path}")
    recipes = value.get("recipes")
    coverage = value.get("coverage")
    if not isinstance(recipes, list) or not isinstance(coverage, dict):
        raise ValueError(f"invalid access recipe index: {path}")
    for position, recipe in enumerate(recipes):
        if not isinstance(recipe, dict) or not isinstance(recipe.get("sourceReference"), str):
            raise ValueError(f"invalid access recipe at position {position}: {path}")
    return value


def _field_path(error: jsonschema.ValidationError) -> str:
    parts = [str(part) for part in error.absolute_path]
    if error.validator == "required":
        missing = error.message.split("'", 2)[1]
        parts.append(missing)
    return ".".join(parts) or "record"


def _load_vocabulary(name: str) -> set[str]:
    path = CATALOGUE_ROOT / "vocabularies" / f"{name}.yml"
    value = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict) or not isinstance(value.get("values"), list):
        raise ValueError(f"invalid vocabulary: {path}")
    return {str(item) for item in value["values"]}


def validate_records(records: list[dict[str, Any]]) -> list[str]:
    errors: list[str] = []
    seen_ids: set[str] = set()
    seen_references: set[tuple[str, str]] = set()
    categories = _load_vocabulary("categories")
    protocols = _load_vocabulary("protocols")
    validator = _validator()

    for record_with_path in records:
        path = str(record_with_path.get("_path", "<unknown>"))
        record = {key: value for key, value in record_with_path.items() if key != "_path"}
        for error in sorted(validator.iter_errors(record), key=lambda item: list(item.path)):
            errors.append(f"{path}:{_field_path(error)}: {error.message}")

        record_id = record.get("id")
        resource_type = record.get("type")
        source_reference = record.get("sourceReference")
        if isinstance(record_id, str):
            if record_id in seen_ids:
                errors.append(f"{path}:id: duplicate id: {record_id}")
            seen_ids.add(record_id)
            if isinstance(resource_type, str) and not record_id.startswith(f"{resource_type}:"):
                errors.append(f"{path}:id: id prefix must match type {resource_type}")
        if isinstance(resource_type, str) and isinstance(source_reference, str):
            key = (resource_type, source_reference)
            if key in seen_references:
                errors.append(
                    f"{path}:sourceReference: duplicate sourceReference within "
                    f"{resource_type}: {source_reference}"
                )
            seen_references.add(key)

        for category in record.get("categories", []):
            if isinstance(category, str) and category not in categories:
                errors.append(f"{path}:categories: unknown category: {category}")
        for protocol in record.get("protocols", []):
            if isinstance(protocol, str) and protocol not in protocols:
                errors.append(f"{path}:protocols: unknown protocol: {protocol}")
        urls = record.get("urls")
        if isinstance(urls, dict) and not any(
            isinstance(urls.get(name), str) for name in ("landing", "documentation")
        ):
            errors.append(f"{path}:urls: landing or documentation URL is required")

    return sorted(errors)


def _counts(records: list[dict[str, Any]]) -> dict[str, Any]:
    def count(field: str, nested: str | None = None) -> dict[str, int]:
        values = []
        for record in records:
            value = record[field]
            if nested is not None:
                value = value[nested]
            values.append(str(value))
        return dict(sorted(Counter(values).items()))

    access_statuses = Counter(
        str(record["accessRecipe"]["effectiveStatus"])
        for record in records
        if isinstance(record.get("accessRecipe"), dict)
    )
    access_recipes = [
        record["accessRecipe"]
        for record in records
        if isinstance(record.get("accessRecipe"), dict)
    ]
    return {
        "total": len(records),
        "byType": count("type"),
        "byTermsEvidenceState": count("termsEvidence", "state"),
        "byTranslationStatus": count("translationStatus"),
        "byAccessStatus": dict(sorted(access_statuses.items())),
        "accessExecutable": sum(recipe.get("request") is not None for recipe in access_recipes),
        "accessLiveVerified": sum(
            recipe.get("effectiveStatus") == "live-verified" for recipe in access_recipes
        ),
    }


def _connector_state(recipe: dict[str, Any]) -> str:
    if recipe.get("request") is not None and recipe.get("effectiveStatus") in {
        "live-verified",
        "fixture-tested",
        "credential-required",
    }:
        return "available"
    if recipe.get("status") in {"blocked", "unavailable"}:
        return "planned"
    return "none"


def build_catalogue(
    records: list[dict[str, Any]], access_index: dict[str, Any]
) -> dict[str, Any]:
    clean = [
        {key: copy.deepcopy(value) for key, value in record.items() if key != "_path"}
        for record in records
    ]
    official_references = {
        str(record["sourceReference"]) for record in clean if record.get("type") == "official"
    }
    recipe_by_reference: dict[str, dict[str, Any]] = {}
    for recipe in access_index["recipes"]:
        reference = str(recipe["sourceReference"])
        if reference in recipe_by_reference:
            raise ValueError(f"duplicate access recipe: {reference}")
        recipe_by_reference[reference] = recipe

    missing = sorted(official_references - recipe_by_reference.keys())
    orphan = sorted(recipe_by_reference.keys() - official_references)
    findings = [f"missing access recipe: {reference}" for reference in missing]
    findings.extend(f"orphan access recipe: {reference}" for reference in orphan)
    if findings:
        raise ValueError("\n".join(findings))

    for record in clean:
        if record.get("type") != "official":
            continue
        recipe = copy.deepcopy(recipe_by_reference[str(record["sourceReference"])])
        integrations = copy.deepcopy(record["integrations"])
        integrations["connector"] = _connector_state(recipe)
        record["integrations"] = integrations
        record["accessRecipe"] = recipe

    clean.sort(key=lambda item: str(item["id"]))
    return {"schemaVersion": 1, "resources": clean, "counts": _counts(clean)}


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


def _search_record(record: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": record["id"],
        "type": record["type"],
        "name": record["name"],
        "summary": record["summary"],
        "provider": record["provider"]["name"],
        "categories": record["categories"],
        "authentication": record["authentication"],
        "termsEvidenceState": record["termsEvidence"]["state"],
    }


def write_outputs(
    catalogue: dict[str, Any], output: Path, access_index: dict[str, Any]
) -> None:
    output.mkdir(parents=True, exist_ok=True)
    resources = catalogue["resources"]
    values: dict[str, Any] = {
        "access-recipes.json": access_index,
        "catalogue.json": catalogue,
        "counts.json": catalogue["counts"],
        "search-index.json": [_search_record(record) for record in resources],
        "stale.json": {
            "schemaVersion": 1,
            "resources": [
                record["id"]
                for record in resources
                if record["verification"]["status"] in {"stale", "unavailable"}
            ],
        },
    }
    for resource_type in RESOURCE_TYPES:
        matching = [record for record in resources if record["type"] == resource_type]
        values[f"{resource_type}.json"] = {
            "schemaVersion": 1,
            "count": len(matching),
            "resources": matching,
        }
    for name in OUTPUT_NAMES:
        (output / name).write_bytes(_json_bytes(values[name]))


def _validated_catalogue() -> tuple[dict[str, Any], dict[str, Any]]:
    records = load_records(CATALOGUE_ROOT)
    errors = validate_records(records)
    if errors:
        raise ValueError("\n".join(errors))
    access_index = load_access_index()
    return build_catalogue(records, access_index), access_index


def _check_outputs(catalogue: dict[str, Any], access_index: dict[str, Any]) -> list[str]:
    with tempfile.TemporaryDirectory(prefix="hk-open-data-catalogue-") as directory:
        expected_root = Path(directory)
        write_outputs(catalogue, expected_root, access_index)
        findings = []
        for name in OUTPUT_NAMES:
            committed = GENERATED_ROOT / name
            expected = expected_root / name
            if not committed.exists() or committed.read_bytes() != expected.read_bytes():
                findings.append(name)
        extras = (
            sorted(
                path.name for path in GENERATED_ROOT.glob("*.json") if path.name not in OUTPUT_NAMES
            )
            if GENERATED_ROOT.exists()
            else []
        )
        return findings + [f"unexpected:{name}" for name in extras]


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Validate and generate HK Open Data metadata")
    parser.add_argument("command", choices=("validate", "generate", "check"))
    args = parser.parse_args(argv)
    try:
        catalogue, access_index = _validated_catalogue()
    except (OSError, ValueError, yaml.YAMLError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        return 1

    if args.command == "validate":
        print(f"validated {catalogue['counts']['total']} resources")
        return 0
    if args.command == "generate":
        write_outputs(catalogue, GENERATED_ROOT, access_index)
        print(f"generated {catalogue['counts']['total']} resources")
        return 0

    drift = _check_outputs(catalogue, access_index)
    if drift:
        print("generated catalogue drift: " + ", ".join(drift), file=sys.stderr)
        return 1
    print(f"generated catalogue is current ({catalogue['counts']['total']} resources)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
