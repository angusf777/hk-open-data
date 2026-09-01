from __future__ import annotations

import os
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Protocol
from urllib.parse import urlsplit

from pydantic import Field

from hk_data_worker.adapters import ADAPTERS
from hk_data_worker.connectors.base import SourceRecordDraft
from hk_data_worker.fetch import (
    BodyTooLarge,
    EgressDenied,
    FetchError,
    FetchTimedOut,
    RetryExhausted,
    UnexpectedMediaType,
    UnsafeRedirect,
)
from hk_data_worker.models import ApprovedRequest, FetchResult

from .errors import AccessFailure, access_failure
from .evidence import schema_fingerprint
from .generation import recipe_sha256
from .models import AccessContractModel, AccessRecipe, AccessStatus, Sha256, VerificationEvidence
from .planning import plan_request


class Fetcher(Protocol):
    def fetch(self, request: ApprovedRequest) -> FetchResult: ...


class ResponseMetadata(AccessContractModel):
    final_host: str
    http_status: int
    elapsed_ms: int = Field(ge=0)
    media_type: str | None
    response_bytes: int = Field(ge=0)
    response_sha256: Sha256


class ExecutionResult(AccessContractModel):
    records: tuple[SourceRecordDraft, ...]
    responses: tuple[ResponseMetadata, ...]


def _failure(
    recipe: AccessRecipe,
    code: str,
    message: str,
    *,
    retryable: bool = False,
) -> AccessFailure:
    return access_failure(
        recipe.source_reference,
        recipe.recipe_version,
        code,
        message,
        retryable=retryable,
    )


def _execution_allowed(recipe: AccessRecipe, *, allow_unverified: bool, verify: bool) -> None:
    if recipe.request is None or recipe.response is None or recipe.adapter == "none":
        raise _failure(
            recipe,
            "RECIPE_NOT_EXECUTABLE",
            "This source cannot be fetched automatically.",
        )
    if verify:
        if recipe.authentication.type != "none":
            raise _failure(
                recipe,
                "AUTH_REQUIRED",
                "Live verification is limited to anonymous sources.",
            )
        return
    if recipe.status is AccessStatus.FIXTURE_TESTED and not allow_unverified:
        raise _failure(
            recipe,
            "RECIPE_NOT_EXECUTABLE",
            "This fixture-tested recipe requires an explicit unverified override.",
        )
    if recipe.status in {
        AccessStatus.MANUAL_ONLY,
        AccessStatus.BLOCKED,
        AccessStatus.UNAVAILABLE,
    }:
        raise _failure(
            recipe,
            "RECIPE_NOT_EXECUTABLE",
            "This source cannot be fetched automatically.",
        )


def _map_fetch_failure(recipe: AccessRecipe, error: FetchError) -> AccessFailure:
    if isinstance(error, UnsafeRedirect | EgressDenied):
        return _failure(recipe, "UNSAFE_REDIRECT", "The provider destination was not permitted.")
    if isinstance(error, BodyTooLarge):
        return _failure(recipe, "RESPONSE_TOO_LARGE", "The provider response exceeded its limit.")
    if isinstance(error, UnexpectedMediaType):
        return _failure(recipe, "MEDIA_TYPE_MISMATCH", "The response media type was not permitted.")
    if isinstance(error, FetchTimedOut | RetryExhausted):
        return _failure(
            recipe,
            "SOURCE_UNAVAILABLE",
            "The provider did not respond successfully.",
            retryable=True,
        )
    return _failure(recipe, "SOURCE_UNAVAILABLE", "The provider request failed.", retryable=True)


def _metadata(result: FetchResult) -> ResponseMetadata:
    host = urlsplit(result.final_url).hostname
    assert host is not None
    media_type = result.headers.get("content-type")
    if media_type is not None:
        media_type = media_type.partition(";")[0].strip().lower()
    return ResponseMetadata(
        final_host=host,
        http_status=result.status_code,
        elapsed_ms=result.elapsed_ms,
        media_type=media_type,
        response_bytes=len(result.body),
        response_sha256=sha256(result.body).hexdigest(),
    )


def _run(
    recipe: AccessRecipe,
    parameters: Mapping[str, object],
    *,
    fetcher: Fetcher,
    environ: Mapping[str, str],
    allow_unverified: bool,
    verify: bool,
) -> tuple[ExecutionResult, tuple[FetchResult, ...]]:
    _execution_allowed(recipe, allow_unverified=allow_unverified, verify=verify)
    adapter = ADAPTERS.get(recipe.adapter)
    if adapter is None:
        raise _failure(recipe, "RECIPE_NOT_EXECUTABLE", "The declared adapter is unavailable.")
    requests = plan_request(recipe, parameters, environ=environ)
    records: list[SourceRecordDraft] = []
    responses: list[FetchResult] = []
    metadata: list[ResponseMetadata] = []
    for request in requests:
        try:
            response = fetcher.fetch(request)
        except FetchError as error:
            raise _map_fetch_failure(recipe, error) from error
        if not 200 <= response.status_code < 300:
            raise _failure(
                recipe,
                "SOURCE_UNAVAILABLE",
                f"The provider returned HTTP {response.status_code}.",
                retryable=response.status_code in request.retry_status_codes,
            )
        parsed = adapter.parse(recipe, response)
        records.extend(parsed)
        responses.append(response)
        metadata.append(_metadata(response))
    record_ids = [record.source_record_id for record in records]
    if len(set(record_ids)) != len(record_ids):
        raise _failure(recipe, "SCHEMA_MISMATCH", "The provider returned duplicate records.")
    return (
        ExecutionResult(records=tuple(records), responses=tuple(metadata)),
        tuple(responses),
    )


def execute_recipe(
    recipe: AccessRecipe,
    parameters: Mapping[str, object],
    *,
    fetcher: Fetcher,
    allow_unverified: bool = False,
    environ: Mapping[str, str] = os.environ,
) -> ExecutionResult:
    result, _responses = _run(
        recipe,
        parameters,
        fetcher=fetcher,
        environ=environ,
        allow_unverified=allow_unverified,
        verify=False,
    )
    return result


def verify_recipe(
    recipe: AccessRecipe,
    *,
    fetcher: Fetcher,
    parameters: Mapping[str, object] | None = None,
    now: datetime | None = None,
    validity: timedelta = timedelta(days=7),
) -> VerificationEvidence:
    checked_at = now or datetime.now(UTC)
    result, raw_responses = _run(
        recipe,
        parameters or {},
        fetcher=fetcher,
        environ={},
        allow_unverified=True,
        verify=True,
    )
    if len(raw_responses) != 1 or len(result.responses) != 1:
        raise _failure(
            recipe,
            "SCHEMA_MISMATCH",
            "Verification evidence requires exactly one bounded response.",
        )
    raw = raw_responses[0]
    response = result.responses[0]
    return VerificationEvidence(
        schema_version=1,
        source_reference=recipe.source_reference,
        recipe_version=recipe.recipe_version,
        recipe_sha256=recipe_sha256(recipe),
        checked_at=checked_at,
        valid_until=checked_at + validity,
        outcome="success",
        error_code=None,
        final_host=response.final_host,
        http_status=response.http_status,
        elapsed_ms=response.elapsed_ms,
        media_type=response.media_type,
        response_bytes=response.response_bytes,
        response_sha256=response.response_sha256,
        schema_fingerprint=schema_fingerprint(raw.body, response.media_type),
        parsed_record_count=len(result.records),
        limitations=recipe.limitations,
        tool_version="0.1.0",
    )
