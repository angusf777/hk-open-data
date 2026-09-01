from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Mapping
from pathlib import Path

import yaml
from hk_data_worker.access.errors import AccessFailure, access_failure
from hk_data_worker.access.evidence import write_evidence_atomic
from hk_data_worker.access.examples import render_example
from hk_data_worker.access.execution import (
    ExecutionResult,
    Fetcher,
    execute_recipe,
    verify_recipe,
)
from hk_data_worker.access.models import AccessRecipe
from hk_data_worker.access.registry import load_recipes
from hk_data_worker.fetch import SafeFetcher

EXIT_BY_CODE = {
    "INVALID_PARAMETER": 2,
    "RECIPE_NOT_FOUND": 2,
    "AUTH_REQUIRED": 3,
    "SOURCE_UNAVAILABLE": 4,
    "SCHEMA_MISMATCH": 5,
    "MEDIA_TYPE_MISMATCH": 5,
    "RECIPE_NOT_EXECUTABLE": 6,
    "UNSAFE_REDIRECT": 7,
    "RESPONSE_TOO_LARGE": 7,
}


def _recipes(repository_root: Path) -> tuple[AccessRecipe, ...]:
    return load_recipes(repository_root / "access" / "recipes" / "official")


def _recipe(repository_root: Path, source_reference: str) -> AccessRecipe:
    normalized = source_reference.upper()
    for recipe in _recipes(repository_root):
        if recipe.source_reference == normalized:
            return recipe
    raise access_failure(
        normalized,
        "unknown",
        "RECIPE_NOT_FOUND",
        f"No access recipe exists for {normalized}.",
    )


def _parameters(values: list[str]) -> dict[str, str]:
    result: dict[str, str] = {}
    for value in values:
        name, separator, raw = value.partition("=")
        if not separator or not name or name in result:
            raise AccessFailure("INVALID_PARAMETER", "Parameters must use unique name=value pairs.")
        result[name] = raw
    return result


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="hkdata",
        description="Offline access recipes and explicit bounded fetches for HK Open Data sources",
    )
    commands = parser.add_subparsers(dest="command", required=True)

    recipe = commands.add_parser("recipe", help="show one source access recipe offline")
    recipe.add_argument("source_reference")
    recipe.add_argument("--format", choices=("json", "yaml"), default="json")

    example = commands.add_parser("example", help="show an offline code example")
    example.add_argument("source_reference")
    example.add_argument("language", choices=("curl", "python", "typescript"))

    fetch = commands.add_parser("fetch", help="explicitly fetch one source")
    fetch.add_argument("source_reference")
    fetch.add_argument("--param", action="append", default=[])
    fetch.add_argument("--allow-unverified", action="store_true")
    fetch.add_argument("--output", choices=("json", "ndjson"), default="json")

    verify = commands.add_parser("verify", help="explicitly verify anonymous source access")
    verify.add_argument("source_reference", nargs="?")
    verify.add_argument("--all-anonymous", action="store_true")
    verify.add_argument("--concurrency", type=int, default=1)
    verify.add_argument("--param", action="append", default=[])
    return parser


def _write_fetch(result: ExecutionResult, output: str) -> None:
    records = result.records
    if output == "ndjson":
        for record in records:
            print(json.dumps(record.model_dump(mode="json"), ensure_ascii=False, sort_keys=True))
    else:
        print(
            json.dumps(
                [record.model_dump(mode="json") for record in records],
                ensure_ascii=False,
                indent=2,
                sort_keys=True,
            )
        )
    diagnostics = [
        response.model_dump(mode="json", by_alias=True)
        for response in result.responses
    ]
    print(json.dumps({"responses": diagnostics}, sort_keys=True), file=sys.stderr)


def _verify_targets(
    repository_root: Path,
    source_reference: str | None,
    all_anonymous: bool,
) -> tuple[AccessRecipe, ...]:
    if all_anonymous:
        if source_reference is not None:
            raise AccessFailure(
                "INVALID_PARAMETER",
                "Choose a source reference or --all-anonymous, not both.",
            )
        return tuple(
            recipe
            for recipe in _recipes(repository_root)
            if recipe.authentication.type == "none" and recipe.request is not None
        )
    if source_reference is None:
        raise AccessFailure("INVALID_PARAMETER", "verify requires a source reference.")
    return (_recipe(repository_root, source_reference),)


def main(
    argv: list[str] | None = None,
    *,
    repository_root: Path | None = None,
    fetcher: Fetcher | None = None,
    environ: Mapping[str, str] = os.environ,
) -> int:
    args = _parser().parse_args(argv)
    root = repository_root or Path.cwd()
    active_fetcher = fetcher or SafeFetcher()
    try:
        if args.command == "recipe":
            recipe = _recipe(root, args.source_reference)
            value = recipe.model_dump(mode="json", by_alias=True)
            if args.format == "yaml":
                print(yaml.safe_dump(value, allow_unicode=True, sort_keys=False), end="")
            else:
                print(json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True))
            return 0
        if args.command == "example":
            print(render_example(_recipe(root, args.source_reference), args.language), end="")
            return 0
        if args.command == "fetch":
            result = execute_recipe(
                _recipe(root, args.source_reference),
                _parameters(args.param),
                fetcher=active_fetcher,
                allow_unverified=args.allow_unverified,
                environ=environ,
            )
            _write_fetch(result, args.output)
            return 0

        if not 1 <= args.concurrency <= 3:
            raise AccessFailure("INVALID_PARAMETER", "verify concurrency must be between 1 and 3.")
        parameters = _parameters(args.param)
        targets = _verify_targets(root, args.source_reference, args.all_anonymous)
        for recipe in targets:
            evidence = verify_recipe(
                recipe,
                fetcher=active_fetcher,
                parameters=parameters,
            )
            path = root / "access" / "verification" / f"{recipe.source_reference.lower()}.json"
            write_evidence_atomic(path, evidence)
            print(f"verified {recipe.source_reference}", file=sys.stderr)
        return 0
    except AccessFailure as error:
        print(f"{error.code}: {error.message}", file=sys.stderr)
        return EXIT_BY_CODE.get(error.code, 6)


def entrypoint() -> None:
    raise SystemExit(main())
