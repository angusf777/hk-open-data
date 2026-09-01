from __future__ import annotations

from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path
from urllib.parse import urlsplit

from .errors import AccessFailure
from .evidence import write_evidence_atomic
from .execution import Fetcher, verify_recipe
from .generation import recipe_sha256
from .models import AccessRecipe, VerificationEvidence


def _failure_evidence(
    recipe: AccessRecipe,
    error: AccessFailure,
    *,
    checked_at: datetime,
    validity: timedelta,
) -> VerificationEvidence:
    assert recipe.request is not None
    host = urlsplit(recipe.request.url_template).hostname
    assert host is not None
    return VerificationEvidence(
        schema_version=1,
        source_reference=recipe.source_reference,
        recipe_version=recipe.recipe_version,
        recipe_sha256=recipe_sha256(recipe),
        checked_at=checked_at,
        valid_until=checked_at + validity,
        outcome="failure",
        error_code=error.code,
        final_host=host,
        http_status=None,
        elapsed_ms=0,
        media_type=None,
        response_bytes=0,
        response_sha256=None,
        schema_fingerprint=None,
        parsed_record_count=0,
        limitations=(
            *recipe.limitations,
            "Verification failed; no provider response content is retained in this evidence.",
        ),
        tool_version="0.1.0",
    )


def verify_all_anonymous(
    recipes: Iterable[AccessRecipe],
    *,
    output: Path,
    fetcher: Fetcher,
    concurrency: int = 1,
    now: datetime | None = None,
    validity: timedelta = timedelta(days=7),
) -> tuple[VerificationEvidence, ...]:
    if not 1 <= concurrency <= 3:
        raise ValueError("verification concurrency must be between 1 and 3")
    checked_at = now or datetime.now(UTC)
    targets = tuple(
        sorted(
            (
                recipe
                for recipe in recipes
                if recipe.request is not None and recipe.authentication.type == "none"
            ),
            key=lambda recipe: recipe.source_reference,
        )
    )

    def attempt(recipe: AccessRecipe) -> VerificationEvidence:
        try:
            return verify_recipe(
                recipe,
                fetcher=fetcher,
                now=checked_at,
                validity=validity,
            )
        except AccessFailure as error:
            return _failure_evidence(
                recipe,
                error,
                checked_at=checked_at,
                validity=validity,
            )

    if concurrency == 1:
        results = tuple(attempt(recipe) for recipe in targets)
    else:
        with ThreadPoolExecutor(max_workers=concurrency) as executor:
            results = tuple(executor.map(attempt, targets))
    for result in results:
        write_evidence_atomic(output / f"{result.source_reference.lower()}.json", result)
    return results
