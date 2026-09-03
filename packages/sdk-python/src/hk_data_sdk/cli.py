from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Mapping
from hashlib import sha256
from pathlib import Path
from urllib.parse import urlsplit

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
from hk_data_worker.access.live import verify_all_anonymous
from hk_data_worker.access.models import AccessRecipe
from hk_data_worker.access.registry import load_recipes
from hk_data_worker.access.resources import (
    RESOURCE_SIZE_LIMIT,
    DataGovResource,
    DataGovResourceInventory,
    render_resource_example,
    resource_request,
    resources_for_source,
)
from hk_data_worker.fetch import (
    BodyTooLarge,
    EgressDenied,
    FetchError,
    FetchTimedOut,
    RetryExhausted,
    SafeFetcher,
    UnsafeRedirect,
)
from hk_data_worker.models import ApprovedRequest, FetchResult

EXIT_BY_CODE = {
    "INVALID_PARAMETER": 2,
    "RECIPE_NOT_FOUND": 2,
    "AUTH_REQUIRED": 3,
    "SOURCE_UNAVAILABLE": 4,
    "SCHEMA_MISMATCH": 5,
    "MEDIA_TYPE_MISMATCH": 5,
    "RECIPE_NOT_EXECUTABLE": 6,
    "RESOURCE_NOT_FOUND": 2,
    "OUTPUT_EXISTS": 2,
    "UNSAFE_REDIRECT": 7,
    "UNSAFE_RESOURCE_URL": 7,
    "RESPONSE_TOO_LARGE": 7,
}


def _recipes(repository_root: Path) -> tuple[AccessRecipe, ...]:
    return load_recipes(repository_root / "access" / "recipes" / "official")


def _repository_root(
    explicit: Path | None,
    environ: Mapping[str, str],
) -> Path:
    if explicit is not None:
        return explicit
    configured = environ.get("HK_OPEN_DATA_REPOSITORY")
    if configured:
        candidate = Path(configured).expanduser().resolve()
        if (candidate / "access" / "recipes" / "official").is_dir():
            return candidate
        raise AccessFailure(
            "INVALID_PARAMETER",
            "HK_OPEN_DATA_REPOSITORY does not point to an hk-open-data checkout.",
        )
    candidates = [Path.cwd(), *Path.cwd().parents, *Path(__file__).resolve().parents]
    for candidate in dict.fromkeys(candidates):
        if (candidate / "access" / "recipes" / "official").is_dir():
            return candidate
    raise AccessFailure(
        "RESOURCE_NOT_FOUND",
        "Run inside an hk-open-data checkout or set HK_OPEN_DATA_REPOSITORY.",
    )


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


def _resource_inventory(repository_root: Path) -> DataGovResourceInventory:
    path = repository_root / "access" / "generated" / "data-gov-resources.json"
    if not path.exists():
        raise AccessFailure(
            "RESOURCE_NOT_FOUND",
            "The generated DATA.GOV.HK resource inventory is not available.",
        )
    return DataGovResourceInventory.model_validate_json(path.read_text(encoding="utf-8"))


def _resource(
    repository_root: Path,
    source_reference: str,
    resource_id: str,
    dataset_id: str | None,
) -> DataGovResource:
    resources = resources_for_source(
        _resource_inventory(repository_root),
        source_reference,
        dataset_id=dataset_id,
    )
    matches = tuple(resource for resource in resources if resource.resource_id == resource_id)
    if len(matches) == 1:
        return matches[0]
    if len(matches) > 1:
        raise AccessFailure(
            "INVALID_PARAMETER",
            "Resource id is ambiguous; specify --dataset.",
            source_reference=source_reference.upper(),
        )
    raise AccessFailure(
        "RESOURCE_NOT_FOUND",
        f"Resource {resource_id} is not mapped to {source_reference.upper()}.",
        source_reference=source_reference.upper(),
    )


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

    resources = commands.add_parser(
        "resources", help="list the current DATA.GOV.HK resources mapped to one source offline"
    )
    resources.add_argument("source_reference")
    resources.add_argument("--dataset")

    resource_example = commands.add_parser(
        "resource-example", help="show code that downloads one mapped provider resource"
    )
    resource_example.add_argument("source_reference")
    resource_example.add_argument("resource_id")
    resource_example.add_argument("language", choices=("curl", "python", "typescript"))
    resource_example.add_argument("--dataset")
    resource_example.add_argument("--param", action="append", default=[])

    fetch_resource = commands.add_parser(
        "fetch-resource", help="explicitly download one mapped provider resource"
    )
    fetch_resource.add_argument("source_reference")
    fetch_resource.add_argument("resource_id")
    fetch_resource.add_argument("--dataset")
    fetch_resource.add_argument("--param", action="append", default=[])
    fetch_resource.add_argument("--max-bytes", type=int, default=RESOURCE_SIZE_LIMIT)
    fetch_resource.add_argument("--output", required=True)

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
    diagnostics = [response.model_dump(mode="json", by_alias=True) for response in result.responses]
    print(json.dumps({"responses": diagnostics}, sort_keys=True), file=sys.stderr)


def _write_resource(body: bytes, output: Path) -> None:
    try:
        with output.open("xb") as stream:
            stream.write(body)
    except FileExistsError as error:
        raise AccessFailure("OUTPUT_EXISTS", f"Output already exists: {output}") from error
    except OSError as error:
        raise AccessFailure("INVALID_PARAMETER", "The output file could not be created.") from error


def _fetch_resource(active_fetcher: Fetcher, request: ApprovedRequest) -> FetchResult:
    try:
        response = active_fetcher.fetch(request)
    except (UnsafeRedirect, EgressDenied) as error:
        raise AccessFailure(
            "UNSAFE_REDIRECT", "The provider destination was not permitted."
        ) from error
    except BodyTooLarge as error:
        raise AccessFailure(
            "RESPONSE_TOO_LARGE", "The provider response exceeded its limit."
        ) from error
    except (FetchTimedOut, RetryExhausted) as error:
        raise AccessFailure(
            "SOURCE_UNAVAILABLE", "The provider did not respond successfully."
        ) from error
    except FetchError as error:
        raise AccessFailure("SOURCE_UNAVAILABLE", "The provider request failed.") from error
    if not 200 <= response.status_code < 300:
        raise AccessFailure(
            "SOURCE_UNAVAILABLE",
            f"The provider returned HTTP {response.status_code}.",
            retryable=response.status_code in request.retry_status_codes,
        )
    return response


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
    active_fetcher = fetcher or SafeFetcher()
    try:
        root = _repository_root(repository_root, environ)
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
        if args.command == "resources":
            values = resources_for_source(
                _resource_inventory(root),
                args.source_reference,
                dataset_id=args.dataset,
            )
            print(
                json.dumps(
                    [item.model_dump(mode="json", by_alias=True) for item in values],
                    ensure_ascii=False,
                    indent=2,
                    sort_keys=True,
                )
            )
            return 0
        if args.command == "resource-example":
            selected_resource = _resource(
                root, args.source_reference, args.resource_id, args.dataset
            )
            print(
                render_resource_example(selected_resource, args.language, _parameters(args.param)),
                end="",
            )
            return 0
        if args.command == "fetch-resource":
            selected_resource = _resource(
                root, args.source_reference, args.resource_id, args.dataset
            )
            request = resource_request(
                selected_resource,
                _parameters(args.param),
                max_bytes=args.max_bytes,
            )
            response = _fetch_resource(active_fetcher, request)
            _write_resource(response.body, Path(args.output))
            host = urlsplit(response.final_url).hostname
            content_type = response.headers.get("content-type")
            print(
                json.dumps(
                    {
                        "datasetId": selected_resource.dataset_id,
                        "elapsedMs": response.elapsed_ms,
                        "finalHost": host,
                        "httpStatus": response.status_code,
                        "mediaType": (
                            None
                            if content_type is None
                            else content_type.partition(";")[0].strip().lower()
                        ),
                        "output": args.output,
                        "resourceId": selected_resource.resource_id,
                        "responseBytes": len(response.body),
                        "responseSha256": sha256(response.body).hexdigest(),
                        "sourceReference": args.source_reference.upper(),
                    },
                    sort_keys=True,
                ),
                file=sys.stderr,
            )
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
        if args.all_anonymous:
            if parameters:
                raise AccessFailure(
                    "INVALID_PARAMETER",
                    "--param cannot be combined with --all-anonymous.",
                )
            results = verify_all_anonymous(
                _recipes(root),
                output=root / "access" / "verification",
                fetcher=active_fetcher,
                concurrency=args.concurrency,
            )
            failure_codes: list[int] = []
            for evidence in results:
                if evidence.outcome == "success":
                    print(f"verified {evidence.source_reference}", file=sys.stderr)
                else:
                    assert evidence.error_code is not None
                    print(
                        f"{evidence.source_reference}: {evidence.error_code}",
                        file=sys.stderr,
                    )
                    failure_codes.append(EXIT_BY_CODE.get(evidence.error_code, 6))
            return max(failure_codes, default=0)
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
