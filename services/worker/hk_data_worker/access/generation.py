from __future__ import annotations

import json
import tempfile
from collections import Counter
from collections.abc import Iterable
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Any

from .examples import ExampleLanguage, render_example
from .models import AccessRecipe, AccessStatus, VerificationEvidence


class RecipeGenerationError(ValueError):
    """The public recipe artifacts cannot be generated truthfully."""


def _json_bytes(value: Any) -> bytes:
    return (json.dumps(value, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()


def _canonical_recipe_bytes(recipe: AccessRecipe) -> bytes:
    return json.dumps(
        recipe.model_dump(mode="json", by_alias=True),
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode()


def recipe_sha256(recipe: AccessRecipe) -> str:
    return sha256(_canonical_recipe_bytes(recipe)).hexdigest()


def effective_status(
    recipe: AccessRecipe,
    evidence: VerificationEvidence | None,
    now: datetime,
) -> AccessStatus:
    if recipe.status is not AccessStatus.LIVE_VERIFIED:
        return recipe.status
    if evidence is None:
        return AccessStatus.FIXTURE_TESTED
    if (
        evidence.source_reference != recipe.source_reference
        or evidence.recipe_version != recipe.recipe_version
        or evidence.recipe_sha256 != recipe_sha256(recipe)
        or evidence.outcome != "success"
        or evidence.valid_until <= now
    ):
        return AccessStatus.FIXTURE_TESTED
    return AccessStatus.LIVE_VERIFIED


def validate_access_registry(
    *,
    catalogue_references: Iterable[str],
    recipes: Iterable[AccessRecipe],
    evidence: Iterable[VerificationEvidence],
    now: datetime | None = None,
) -> list[str]:
    checked_at = now or datetime.now(UTC)
    catalogue = set(catalogue_references)
    recipe_items = tuple(recipes)
    evidence_by_reference = {
        item.source_reference: item
        for item in evidence
    }
    recipe_references = [recipe.source_reference for recipe in recipe_items]
    recipe_set = set(recipe_references)
    findings = [
        f"duplicate recipe: {reference}"
        for reference, count in sorted(Counter(recipe_references).items())
        if count > 1
    ]
    findings.extend(f"missing recipe: {reference}" for reference in sorted(catalogue - recipe_set))
    findings.extend(f"orphan recipe: {reference}" for reference in sorted(recipe_set - catalogue))
    findings.extend(
        f"live-verified recipe lacks current matching evidence: {recipe.source_reference}"
        for recipe in recipe_items
        if recipe.status is AccessStatus.LIVE_VERIFIED
        and effective_status(
            recipe,
            evidence_by_reference.get(recipe.source_reference),
            checked_at,
        )
        is not AccessStatus.LIVE_VERIFIED
    )
    return findings


def _coverage(
    recipes: tuple[AccessRecipe, ...],
    *,
    evidence: dict[str, VerificationEvidence],
    now: datetime,
    total_official: int,
) -> dict[str, object]:
    counts = Counter(
        effective_status(recipe, evidence.get(recipe.source_reference), now).value
        for recipe in recipes
    )
    classified = len({recipe.source_reference for recipe in recipes})
    return {
        "totalOfficial": total_official,
        "unclassified": max(0, total_official - classified),
        "byStatus": {status.value: counts[status.value] for status in AccessStatus},
    }


def _write_tree(
    root: Path,
    *,
    recipes: tuple[AccessRecipe, ...],
    coverage: dict[str, object],
    evidence: dict[str, VerificationEvidence],
    now: datetime,
) -> None:
    public_recipes: list[dict[str, object]] = []
    for recipe in recipes:
        languages: tuple[ExampleLanguage, ...] = ("curl", "python", "typescript")
        examples: dict[ExampleLanguage, str | None] = {
            language: render_example(recipe, language) if recipe.request is not None else None
            for language in languages
        }
        reference = recipe.source_reference.lower()
        suffixes = {"curl": "sh", "python": "py", "typescript": "ts"}
        for language, example in examples.items():
            if example is None:
                continue
            path = root / "examples" / language / f"{reference}.{suffixes[language]}"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(example, encoding="utf-8")
        public_recipes.append(
            {
                **recipe.model_dump(mode="json", by_alias=True),
                "recipeSha256": recipe_sha256(recipe),
                "effectiveStatus": effective_status(
                    recipe,
                    evidence.get(recipe.source_reference),
                    now,
                ).value,
                "examples": examples,
                "verification": _verification_summary(
                    evidence.get(recipe.source_reference)
                ),
            }
        )
    index = {
        "schemaVersion": 1,
        "generatedAt": None,
        "recipes": public_recipes,
        "coverage": coverage,
    }
    (root / "recipes.json").write_bytes(_json_bytes(index))
    (root / "coverage.json").write_bytes(_json_bytes(coverage))


def _verification_summary(
    evidence: VerificationEvidence | None,
) -> dict[str, object] | None:
    if evidence is None:
        return None
    summary = evidence.model_dump(mode="json", by_alias=True)
    for field in ("schemaVersion", "sourceReference", "recipeVersion"):
        summary.pop(field)
    return summary


def _publish_tree(staged: Path, output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    for filename in ("recipes.json", "coverage.json"):
        (output / filename).unlink(missing_ok=True)
    examples = output / "examples"
    if examples.exists():
        for current in sorted(examples.rglob("*"), reverse=True):
            if current.is_file():
                current.unlink()
            elif current.is_dir():
                current.rmdir()
        if examples.exists():
            examples.rmdir()
    for staged_file in sorted(path for path in staged.rglob("*") if path.is_file()):
        relative = staged_file.relative_to(staged)
        destination = output / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        staged_file.replace(destination)


def generate_access_artifacts(
    *,
    catalogue_references: Iterable[str],
    recipes: Iterable[AccessRecipe],
    evidence: Iterable[VerificationEvidence],
    output: Path,
    now: datetime | None = None,
) -> dict[str, object]:
    catalogue = tuple(catalogue_references)
    ordered = tuple(sorted(recipes, key=lambda recipe: recipe.source_reference))
    checked_at = now or datetime.now(UTC)
    evidence_items = tuple(evidence)
    evidence_by_reference = {
        item.source_reference: item
        for item in evidence_items
    }
    findings = validate_access_registry(
        catalogue_references=catalogue,
        recipes=ordered,
        evidence=evidence_items,
        now=checked_at,
    )
    if findings:
        raise RecipeGenerationError("\n".join(findings))
    coverage = _coverage(
        ordered,
        evidence=evidence_by_reference,
        now=checked_at,
        total_official=len(set(catalogue)),
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="hk-open-data-access-", dir=output.parent) as directory:
        staged = Path(directory)
        _write_tree(
            staged,
            recipes=ordered,
            coverage=coverage,
            evidence=evidence_by_reference,
            now=checked_at,
        )
        index = json.loads((staged / "recipes.json").read_text(encoding="utf-8"))
        _publish_tree(staged, output)
    if not isinstance(index, dict):
        raise RecipeGenerationError("generated recipe index must be an object")
    return index
