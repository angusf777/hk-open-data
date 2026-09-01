from __future__ import annotations

from enum import StrEnum
from typing import Annotated, Literal
from urllib.parse import urlsplit

from pydantic import BaseModel, ConfigDict, Field, model_validator


def _to_camel(value: str) -> str:
    head, *tail = value.split("_")
    return head + "".join(part.capitalize() for part in tail)


class AccessContractModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=_to_camel,
        extra="forbid",
        frozen=True,
        populate_by_name=True,
        serialize_by_alias=True,
    )


class AccessStatus(StrEnum):
    LIVE_VERIFIED = "live-verified"
    FIXTURE_TESTED = "fixture-tested"
    CREDENTIAL_REQUIRED = "credential-required"
    MANUAL_ONLY = "manual-only"
    BLOCKED = "blocked"
    UNAVAILABLE = "unavailable"


AdapterName = Literal[
    "none",
    "ckan-action",
    "rest-json",
    "odata",
    "arcgis-rest",
    "ogc-wfs",
    "ogc-wms",
    "xml",
    "csv",
    "rss",
    "file-download",
]
HttpsUrl = Annotated[str, Field(pattern=r"^https://")]
EnvironmentVariable = Annotated[str, Field(pattern=r"^[A-Z][A-Z0-9_]{2,127}$")]
JsonScalar = str | int | float | bool


class AuthenticationSpec(AccessContractModel):
    type: Literal["none", "api-key", "bearer", "basic", "oauth2", "registration"]
    environment_variables: tuple[EnvironmentVariable, ...] = ()
    setup: str | None = None

    @model_validator(mode="after")
    def require_declared_credential_setup(self) -> AuthenticationSpec:
        if self.type == "none":
            if self.environment_variables or self.setup is not None:
                raise ValueError("authentication type none cannot declare credential setup")
        elif not self.environment_variables or not self.setup:
            raise ValueError(
                "credential-required recipes require environment variables and setup instructions"
            )
        return self


class ParameterSpec(AccessContractModel):
    name: Annotated[str, Field(min_length=1)]
    location: Literal["path", "query", "header", "body"]
    data_type: Literal["string", "integer", "number", "boolean", "date", "datetime"]
    required: bool
    default: JsonScalar | None = None
    example: JsonScalar | None = None
    description: Annotated[str, Field(min_length=1)]
    enum: tuple[JsonScalar, ...] = ()


class HeaderSpec(AccessContractModel):
    name: Annotated[str, Field(min_length=1)]
    value: str | None = None
    environment_variable: EnvironmentVariable | None = None

    @model_validator(mode="after")
    def require_safe_value_source(self) -> HeaderSpec:
        if (self.value is None) == (self.environment_variable is None):
            raise ValueError("header requires exactly one value source")
        if self.name.lower() in {"authorization", "cookie", "proxy-authorization"} and self.value:
            raise ValueError("credential values are forbidden in recipes")
        return self


class RetrySpec(AccessContractModel):
    attempts: Annotated[int, Field(ge=1, le=3)] = 1
    status_codes: tuple[Annotated[int, Field(ge=100, le=599)], ...] = ()

    @model_validator(mode="after")
    def require_unique_status_codes(self) -> RetrySpec:
        if len(set(self.status_codes)) != len(self.status_codes):
            raise ValueError("retry status codes must be unique")
        return self


class PaginationSpec(AccessContractModel):
    strategy: Literal[
        "none",
        "offset",
        "cursor",
        "next-link",
        "page-number",
        "provider-specific",
    ]
    next_path: str | None = None


class NormalizationSpec(AccessContractModel):
    fields: dict[str, str]
    language: str | None = None
    geometry: str | None = None
    timestamp: str | None = None


class AccessRequest(AccessContractModel):
    method: Literal["GET", "POST", "HEAD"]
    url_template: HttpsUrl
    allowed_hosts: tuple[Annotated[str, Field(min_length=1)], ...]
    parameters: tuple[ParameterSpec, ...] = ()
    headers: tuple[HeaderSpec, ...] = ()
    body_template: dict[str, object] | str | None = None
    timeout_ms: Annotated[int, Field(ge=1_000, le=60_000)] = 30_000
    max_response_bytes: Annotated[int, Field(gt=0, le=25 * 1024 * 1024)] = 10 * 1024 * 1024
    max_pages: Annotated[int, Field(ge=1, le=100)] = 1
    retry: RetrySpec = RetrySpec()

    @model_validator(mode="after")
    def require_safe_request_shape(self) -> AccessRequest:
        parsed = urlsplit(self.url_template)
        try:
            port = parsed.port
        except ValueError as error:
            raise ValueError(
                "request destination must be a credential-free HTTPS URL on port 443"
            ) from error
        if (
            parsed.scheme != "https"
            or parsed.hostname is None
            or parsed.username is not None
            or parsed.password is not None
            or port not in {None, 443}
            or parsed.fragment
        ):
            raise ValueError("request destination must be a credential-free HTTPS URL on port 443")
        host = parsed.hostname
        allowed = {value.lower().rstrip(".") for value in self.allowed_hosts}
        if host.lower().rstrip(".") not in allowed:
            raise ValueError("initial request host must be allowlisted")
        if len(allowed) != len(self.allowed_hosts):
            raise ValueError("allowed hosts must be unique")
        parameter_names = [parameter.name for parameter in self.parameters]
        if len(set(parameter_names)) != len(parameter_names):
            raise ValueError("parameter names must be unique")
        header_names = [header.name.lower() for header in self.headers]
        if len(set(header_names)) != len(header_names):
            raise ValueError("header names must be unique")
        if self.method in {"GET", "HEAD"} and self.body_template is not None:
            raise ValueError(f"{self.method} recipes cannot define a request body")
        return self


class ResponseSpec(AccessContractModel):
    media_types: tuple[Annotated[str, Field(min_length=1)], ...]
    record_path: str
    id_path: str | None = None
    timestamp_path: str | None = None
    pagination: PaginationSpec
    normalization: NormalizationSpec

    @model_validator(mode="after")
    def require_unique_media_types(self) -> ResponseSpec:
        normalized = [value.lower() for value in self.media_types]
        if len(set(normalized)) != len(normalized):
            raise ValueError("response media types must be unique")
        return self


class AccessRecipe(AccessContractModel):
    schema_version: Literal[1]
    source_reference: Annotated[str, Field(pattern=r"^HKAPI-[0-9]{3}$")]
    recipe_version: Annotated[str, Field(pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$")]
    adapter: AdapterName
    status: AccessStatus
    documentation_url: HttpsUrl
    limitations: tuple[Annotated[str, Field(min_length=1)], ...]
    authentication: AuthenticationSpec
    request: AccessRequest | None
    response: ResponseSpec | None
    reason: str | None = None
    next_action: str | None = None

    @model_validator(mode="after")
    def require_consistent_execution_status(self) -> AccessRecipe:
        if self.status in {
            AccessStatus.LIVE_VERIFIED,
            AccessStatus.FIXTURE_TESTED,
            AccessStatus.CREDENTIAL_REQUIRED,
        }:
            if self.request is None:
                raise ValueError(f"{self.status.value} recipes require a request")
            if self.response is None:
                raise ValueError(f"{self.status.value} recipes require a response")
            if self.adapter == "none":
                raise ValueError(f"{self.status.value} recipes require an adapter")
        if self.status in {AccessStatus.MANUAL_ONLY, AccessStatus.BLOCKED}:
            if self.request is not None:
                raise ValueError(f"{self.status.value} recipes cannot define a request")
            if self.response is not None or self.adapter != "none":
                raise ValueError(f"{self.status.value} recipes are not executable")
            if not self.reason:
                raise ValueError(f"{self.status.value} recipes require a reason")
            if not self.next_action:
                raise ValueError(f"{self.status.value} recipes require a next action")
        if self.status is AccessStatus.CREDENTIAL_REQUIRED and (
            self.authentication.type == "none"
            or not self.authentication.environment_variables
            or not self.authentication.setup
        ):
            raise ValueError(
                "credential-required recipes require environment variables and setup instructions"
            )
        if self.status is AccessStatus.UNAVAILABLE:
            if not self.reason or not self.next_action:
                raise ValueError("unavailable recipes require a reason and next action")
            if self.request is None and (self.adapter != "none" or self.response is not None):
                raise ValueError("unavailable recipes without a request are not executable")
            if self.request is not None and (self.adapter == "none" or self.response is None):
                raise ValueError("unavailable recovery checks require an adapter and response")
        return self
