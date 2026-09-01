from __future__ import annotations

import json
import math
from collections.abc import Mapping
from datetime import date, datetime
from urllib.parse import quote, urlencode, urlsplit

from hk_data_worker.models import ApprovedRequest

from .errors import AccessFailure, access_failure
from .models import AccessRecipe, JsonScalar, ParameterSpec


def _failure(recipe: AccessRecipe, code: str, message: str) -> AccessFailure:
    return access_failure(
        recipe.source_reference,
        recipe.recipe_version,
        code,
        message,
    )


def _coerce(spec: ParameterSpec, raw: object) -> JsonScalar:
    try:
        if spec.data_type == "string":
            if not isinstance(raw, str):
                raise ValueError
            return raw
        if spec.data_type == "integer":
            if isinstance(raw, bool) or not isinstance(raw, str | int | float):
                raise ValueError
            return int(raw)
        if spec.data_type == "number":
            if isinstance(raw, bool) or not isinstance(raw, str | int | float):
                raise ValueError
            value = float(raw)
            if not math.isfinite(value):
                raise ValueError
            return value
        if spec.data_type == "boolean":
            if isinstance(raw, bool):
                return raw
            if isinstance(raw, str) and raw.lower() in {"true", "false"}:
                return raw.lower() == "true"
            raise ValueError
        if spec.data_type == "date":
            if not isinstance(raw, str):
                raise ValueError
            return date.fromisoformat(raw).isoformat()
        if spec.data_type == "datetime":
            if not isinstance(raw, str):
                raise ValueError
            parsed = datetime.fromisoformat(raw.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                raise ValueError
            return parsed.isoformat().replace("+00:00", "Z")
    except (TypeError, ValueError, OverflowError) as error:
        raise ValueError(f"invalid {spec.data_type}") from error
    raise ValueError(f"unsupported parameter type: {spec.data_type}")


def coerce_parameters(
    recipe: AccessRecipe,
    values: Mapping[str, object],
) -> dict[str, JsonScalar]:
    request = recipe.request
    if request is None:
        raise _failure(recipe, "NOT_EXECUTABLE", "This source has no executable request.")
    declared = {parameter.name: parameter for parameter in request.parameters}
    unknown = sorted(set(values) - set(declared))
    if unknown:
        raise _failure(
            recipe,
            "INVALID_PARAMETER",
            f"Unsupported parameter: {unknown[0]}",
        )
    result: dict[str, JsonScalar] = {}
    for spec in request.parameters:
        raw = values.get(spec.name, spec.default)
        if raw is None:
            if spec.required:
                raise _failure(
                    recipe,
                    "INVALID_PARAMETER",
                    f"Missing parameter: {spec.name}",
                )
            continue
        try:
            parsed = _coerce(spec, raw)
        except ValueError as error:
            raise _failure(
                recipe,
                "INVALID_PARAMETER",
                f"Invalid value for {spec.name}.",
            ) from error
        if spec.enum and parsed not in spec.enum:
            raise _failure(
                recipe,
                "INVALID_PARAMETER",
                f"Unsupported value for {spec.name}.",
            )
        result[spec.name] = parsed
    return result


def _render_scalar(value: JsonScalar) -> str:
    return str(value).lower() if isinstance(value, bool) else str(value)


def _validate_final_url(recipe: AccessRecipe, url: str) -> None:
    parsed = urlsplit(url)
    try:
        port = parsed.port
    except ValueError as error:
        raise _failure(
            recipe,
            "INVALID_REQUEST",
            "The final request URL is not permitted.",
        ) from error
    request = recipe.request
    if request is None:
        raise _failure(recipe, "NOT_EXECUTABLE", "This source has no executable request.")
    allowed = {host.lower().rstrip(".") for host in request.allowed_hosts}
    if (
        parsed.scheme != "https"
        or parsed.hostname is None
        or parsed.hostname.lower().rstrip(".") not in allowed
        or parsed.username is not None
        or parsed.password is not None
        or port not in {None, 443}
        or parsed.fragment
    ):
        raise _failure(recipe, "INVALID_REQUEST", "The final request URL is not permitted.")


def plan_request(
    recipe: AccessRecipe,
    parameters: Mapping[str, object],
    *,
    environ: Mapping[str, str],
) -> tuple[ApprovedRequest, ...]:
    request = recipe.request
    response = recipe.response
    if request is None or response is None or recipe.adapter == "none":
        raise _failure(recipe, "NOT_EXECUTABLE", "This source has no executable request.")
    values = coerce_parameters(recipe, parameters)
    url = request.url_template
    query: list[tuple[str, str]] = []
    parameter_by_name = {parameter.name: parameter for parameter in request.parameters}
    for name, value in values.items():
        spec = parameter_by_name[name]
        rendered = _render_scalar(value)
        if spec.location == "path":
            placeholder = "{" + name + "}"
            if placeholder not in url:
                raise _failure(
                    recipe,
                    "INVALID_REQUEST",
                    f"The request template is missing parameter {name}.",
                )
            url = url.replace(placeholder, quote(rendered, safe=""))
        elif spec.location == "query":
            query.append((name, rendered))
    if query:
        url += ("&" if "?" in url else "?") + urlencode(query)
    _validate_final_url(recipe, url)

    missing = [
        name
        for name in recipe.authentication.environment_variables
        if not environ.get(name)
    ]
    if missing:
        raise _failure(
            recipe,
            "AUTH_REQUIRED",
            f"Set the required environment variable: {missing[0]}",
        )
    headers: dict[str, str] = {}
    for header in request.headers:
        if header.value is not None:
            headers[header.name] = header.value
        else:
            assert header.environment_variable is not None
            credential_value = environ.get(header.environment_variable)
            if not credential_value:
                raise _failure(
                    recipe,
                    "AUTH_REQUIRED",
                    f"Set the required environment variable: {header.environment_variable}",
                )
            headers[header.name] = (
                f"Bearer {credential_value}"
                if recipe.authentication.type == "bearer"
                and header.name.lower() == "authorization"
                else credential_value
            )
    body = request.body_template
    serialized_body = None
    if body is not None:
        serialized_body = (
            body.encode()
            if isinstance(body, str)
            else json.dumps(
                body,
                ensure_ascii=False,
                separators=(",", ":"),
                sort_keys=True,
            ).encode()
        )
    return (
        ApprovedRequest(
            method=request.method,
            url=url,
            allowed_hosts=request.allowed_hosts,
            timeout_ms=request.timeout_ms,
            max_response_bytes=request.max_response_bytes,
            max_compressed_response_bytes=request.max_response_bytes,
            max_attempts=request.retry.attempts,
            retry_status_codes=request.retry.status_codes,
            allowed_media_types=response.media_types,
            headers=headers,
            body=serialized_body,
        ),
    )
