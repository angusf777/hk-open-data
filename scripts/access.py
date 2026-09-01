from __future__ import annotations

import argparse
import json
import sys
import tempfile
from pathlib import Path

import yaml
from hk_data_worker.access.generation import (
    RecipeGenerationError,
    generate_access_artifacts,
    validate_access_registry,
)
from hk_data_worker.access.models import AccessRecipe, VerificationEvidence
from hk_data_worker.access.registry import RecipeLoader, load_recipes
from pydantic import ValidationError

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


def _official_references(repository_root: Path) -> tuple[str, ...]:
    references: list[str] = []
    for path in sorted((repository_root / "catalog" / "official").glob("*.yml")):
        value = yaml.load(path.read_text(encoding="utf-8"), Loader=RecipeLoader)
        if not isinstance(value, dict) or value.get("publicationStatus") != "published":
            continue
        reference = value.get("sourceReference")
        if not isinstance(reference, str):
            raise ValueError(f"{path}: published resource lacks sourceReference")
        references.append(reference)
    return tuple(references)


def _verification_evidence(repository_root: Path) -> tuple[VerificationEvidence, ...]:
    evidence_root = repository_root / "access" / "verification"
    items: list[VerificationEvidence] = []
    seen: set[str] = set()
    for path in sorted(evidence_root.glob("*.json")):
        value = json.loads(path.read_text(encoding="utf-8"))
        item = VerificationEvidence.model_validate(value)
        if item.source_reference in seen:
            raise ValueError(f"duplicate verification evidence: {item.source_reference}")
        seen.add(item.source_reference)
        items.append(item)
    return tuple(items)


def _tree_bytes(root: Path) -> dict[str, bytes]:
    if not root.exists():
        return {}
    return {
        str(path.relative_to(root)): path.read_bytes()
        for path in sorted(root.rglob("*"))
        if path.is_file()
    }


def _status_document(index: dict[str, object]) -> str:
    coverage = index.get("coverage")
    public_recipes = index.get("recipes")
    if not isinstance(coverage, dict) or not isinstance(public_recipes, list):
        raise RecipeGenerationError("generated access index lacks coverage or recipes")
    by_status = coverage.get("byStatus")
    if not isinstance(by_status, dict):
        raise RecipeGenerationError("generated access coverage lacks status counts")

    outcomes = {"success": 0, "failure": 0}
    rows: list[str] = []
    for value in public_recipes:
        if not isinstance(value, dict):
            raise RecipeGenerationError("generated access recipe must be an object")
        verification = value.get("verification")
        outcome = "not-run"
        if isinstance(verification, dict):
            recorded = verification.get("outcome")
            if recorded in outcomes:
                outcome = recorded
                outcomes[recorded] += 1
        reference = value.get("sourceReference")
        status = value.get("effectiveStatus")
        adapter = value.get("adapter")
        documentation = value.get("documentationUrl")
        if not all(isinstance(item, str) for item in (reference, status, adapter, documentation)):
            raise RecipeGenerationError("generated access recipe lacks public status fields")
        rows.append(
            f"| {reference} | {status} | {adapter} | {outcome} | "
            f"[Official source]({documentation}) |"
        )

    attempts = outcomes["success"] + outcomes["failure"]
    lines = [
        "# Official source access status",
        "",
        (
            "This generated review index records what the toolkit can execute safely today. "
            "A manual-only entry is an explicit boundary, not a claim that the underlying "
            "public data is unavailable. Live evidence is a time-limited technical check, not "
            "a guarantee of future availability, data quality, licensing or permitted use."
        ),
        "",
        f'- Total official sources: {coverage.get("totalOfficial", 0)}',
        f"- Live verification attempts recorded: {attempts}",
        f'- Successful live verification records: {outcomes["success"]}',
        f'- Failed live verification records: {outcomes["failure"]}',
        f'- Live-verified recipes: {by_status.get("live-verified", 0)}',
        f'- Fixture-tested recipes: {by_status.get("fixture-tested", 0)}',
        f'- Manual-only recipes: {by_status.get("manual-only", 0)}',
        f'- Credential-required recipes: {by_status.get("credential-required", 0)}',
        f'- Blocked recipes: {by_status.get("blocked", 0)}',
        f'- Unavailable recipes: {by_status.get("unavailable", 0)}',
        f'- Unclassified official sources: {coverage.get("unclassified", 0)}',
        "",
        "| Source | Effective status | Adapter | Latest verification | Official documentation |",
        "| --- | --- | --- | --- | --- |",
        *rows,
        "",
    ]
    return "\n".join(lines)


def _write_status_document(repository_root: Path, index: dict[str, object]) -> None:
    destination = repository_root / "docs" / "access" / "source-status.md"
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(_status_document(index), encoding="utf-8")


def _inputs(
    repository_root: Path,
) -> tuple[tuple[str, ...], tuple[AccessRecipe, ...], tuple[VerificationEvidence, ...]]:
    references = _official_references(repository_root)
    recipes = load_recipes(repository_root / "access" / "recipes" / "official")
    evidence = _verification_evidence(repository_root)
    return references, recipes, evidence


def main(argv: list[str] | None = None, *, repository_root: Path = REPOSITORY_ROOT) -> int:
    parser = argparse.ArgumentParser(
        description="Validate and generate the HK Open Data source-access registry"
    )
    parser.add_argument("command", choices=("validate", "generate", "check"))
    args = parser.parse_args(argv)
    try:
        references, recipes, evidence = _inputs(repository_root)
        findings = validate_access_registry(
            catalogue_references=references,
            recipes=recipes,
            evidence=evidence,
        )
        if findings:
            raise RecipeGenerationError("\n".join(findings))
        if args.command == "validate":
            print(f"validated {len(recipes)} official access recipes")
            return 0

        output = repository_root / "access" / "generated"
        if args.command == "generate":
            index = generate_access_artifacts(
                catalogue_references=references,
                recipes=recipes,
                evidence=evidence,
                output=output,
            )
            _write_status_document(repository_root, index)
            print(f"generated {len(recipes)} official access recipes")
            return 0

        output.parent.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(
            prefix="hk-open-data-access-check-", dir=output.parent
        ) as directory:
            expected = Path(directory)
            index = generate_access_artifacts(
                catalogue_references=references,
                recipes=recipes,
                evidence=evidence,
                output=expected,
            )
            if _tree_bytes(expected) != _tree_bytes(output):
                print("generated access artifacts have drifted", file=sys.stderr)
                return 1
            status_path = repository_root / "docs" / "access" / "source-status.md"
            if not status_path.exists() or status_path.read_text(
                encoding="utf-8"
            ) != _status_document(index):
                print("generated access status document has drifted", file=sys.stderr)
                return 1
        print(f"generated access artifacts are current ({len(recipes)} recipes)")
        return 0
    except (
        OSError,
        ValueError,
        yaml.YAMLError,
        json.JSONDecodeError,
        ValidationError,
    ) as error:
        print(error, file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
