from __future__ import annotations

from uuid import uuid4


class AccessFailure(RuntimeError):
    """Stable, non-secret-bearing failure returned by source-access operations."""

    def __init__(
        self,
        code: str,
        message: str,
        *,
        retryable: bool = False,
        source_reference: str | None = None,
        recipe_version: str | None = None,
        correlation_id: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.retryable = retryable
        self.source_reference = source_reference
        self.recipe_version = recipe_version
        self.correlation_id = correlation_id or str(uuid4())


def access_failure(
    recipe_source: str,
    recipe_version: str,
    code: str,
    message: str,
    *,
    retryable: bool = False,
) -> AccessFailure:
    return AccessFailure(
        code,
        message,
        retryable=retryable,
        source_reference=recipe_source,
        recipe_version=recipe_version,
    )
