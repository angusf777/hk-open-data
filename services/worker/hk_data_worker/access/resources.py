from __future__ import annotations

import re
import shlex
from collections.abc import Mapping, Sequence
from datetime import datetime
from typing import Annotated, Literal
from urllib.parse import quote, urlsplit

from pydantic import Field

from hk_data_worker.models import ApprovedRequest

from .errors import AccessFailure
from .models import AccessContractModel

RESOURCE_SIZE_LIMIT = 25 * 1024 * 1024
ResourceAccess = Literal["ready", "parameters-required", "insecure-http", "invalid-url"]
_PLACEHOLDER = re.compile(r"\{([A-Za-z][A-Za-z0-9_]*)\}|<([A-Za-z][A-Za-z0-9_]*)>")
_FORMAT_PRIORITY = {
    "API": 0,
    "JSON": 1,
    "GEOJSON": 2,
    "XML": 3,
    "RSS": 4,
    "CSV": 5,
    "GTFS": 6,
}


class DataGovResource(AccessContractModel):
    schema_version: Literal[1] = 1
    source_references: tuple[Annotated[str, Field(pattern=r"^HKAPI-[0-9]{3}$")], ...]
    dataset_id: Annotated[str, Field(min_length=1)]
    resource_id: Annotated[str, Field(min_length=1)]
    name: Annotated[str, Field(min_length=1)]
    format: Annotated[str, Field(min_length=1)]
    url_template: Annotated[str, Field(min_length=1)]
    template_parameters: tuple[str, ...]
    access: ResourceAccess


class DataGovResourceInventory(AccessContractModel):
    schema_version: Literal[1]
    checked_at: datetime
    package_endpoint: Annotated[str, Field(pattern=r"^https://")]
    resources: tuple[DataGovResource, ...]


def _resource_access(url: str, parameters: tuple[str, ...]) -> ResourceAccess:
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError:
        return "invalid-url"
    if (
        parsed.hostname is None
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
        or port not in {None, 80, 443}
        or "{" in parsed.hostname
        or "}" in parsed.hostname
    ):
        return "invalid-url"
    if parsed.scheme == "http":
        return "insecure-http"
    if parsed.scheme != "https" or port not in {None, 443}:
        return "invalid-url"
    return "parameters-required" if parameters else "ready"


def build_resource(
    dataset_id: str,
    source_references: Sequence[str],
    raw: Mapping[str, object],
) -> DataGovResource:
    resource_id = raw.get("id")
    name = raw.get("name")
    format_name = raw.get("format")
    url = raw.get("url")
    if not isinstance(resource_id, str) or not resource_id:
        raise ValueError(f"{dataset_id} contains a resource without an id")
    if not isinstance(name, str) or not name:
        name = resource_id
    if not isinstance(format_name, str) or not format_name:
        format_name = "OTHER"
    if not isinstance(url, str) or not url:
        raise ValueError(f"{dataset_id}/{resource_id} contains no resource URL")
    parameters = tuple(
        dict.fromkeys(match.group(1) or match.group(2) for match in _PLACEHOLDER.finditer(url))
    )
    return DataGovResource(
        source_references=tuple(sorted(set(source_references))),
        dataset_id=dataset_id,
        resource_id=resource_id,
        name=name,
        format=format_name.upper(),
        url_template=url,
        template_parameters=parameters,
        access=_resource_access(url, parameters),
    )


def resources_for_source(
    inventory: DataGovResourceInventory,
    source_reference: str,
    *,
    dataset_id: str | None = None,
) -> tuple[DataGovResource, ...]:
    reference = source_reference.upper()
    source_resources = tuple(
        resource for resource in inventory.resources if reference in resource.source_references
    )
    resources = (
        source_resources
        if dataset_id is None
        else tuple(resource for resource in source_resources if resource.dataset_id == dataset_id)
    )
    if resources:
        return resources
    if source_resources and dataset_id is not None:
        raise AccessFailure(
            "INVALID_PARAMETER",
            f"Dataset {dataset_id} is not mapped to {reference}.",
            source_reference=reference,
        )
    detail = f" for dataset {dataset_id}" if dataset_id is not None else ""
    raise AccessFailure(
        "RESOURCE_NOT_FOUND",
        f"No DATA.GOV.HK resources are mapped to {reference}{detail}.",
        source_reference=reference,
    )


def resolve_resource_url(
    resource: DataGovResource,
    parameters: Mapping[str, str],
) -> str:
    if resource.access in {"insecure-http", "invalid-url"}:
        raise AccessFailure(
            "UNSAFE_RESOURCE_URL",
            "Resource fetching requires a credential-free HTTPS URL on port 443.",
            source_reference=resource.source_references[0],
        )
    unknown = sorted(set(parameters) - set(resource.template_parameters))
    if unknown:
        raise AccessFailure(
            "INVALID_PARAMETER",
            f"Unsupported parameter: {unknown[0]}",
            source_reference=resource.source_references[0],
        )
    missing = [name for name in resource.template_parameters if name not in parameters]
    if missing:
        raise AccessFailure(
            "INVALID_PARAMETER",
            f"Set the required resource parameter: {missing[0]}",
            source_reference=resource.source_references[0],
        )
    resolved = resource.url_template
    for name in resource.template_parameters:
        resolved = resolved.replace("{" + name + "}", quote(parameters[name], safe=""))
        resolved = resolved.replace("<" + name + ">", quote(parameters[name], safe=""))
    original = urlsplit(resource.url_template)
    parsed = urlsplit(resolved)
    try:
        port = parsed.port
    except ValueError as error:
        raise AccessFailure("UNSAFE_RESOURCE_URL", "Resolved resource URL is invalid.") from error
    if (
        parsed.scheme != "https"
        or parsed.hostname is None
        or original.hostname is None
        or parsed.hostname.lower().rstrip(".") != original.hostname.lower().rstrip(".")
        or parsed.username is not None
        or parsed.password is not None
        or parsed.fragment
        or port not in {None, 443}
        or _PLACEHOLDER.search(resolved)
    ):
        raise AccessFailure(
            "UNSAFE_RESOURCE_URL",
            "Resolved resource URL is not permitted.",
            source_reference=resource.source_references[0],
        )
    return resolved


def resource_request(
    resource: DataGovResource,
    parameters: Mapping[str, str],
    *,
    max_bytes: int = RESOURCE_SIZE_LIMIT,
) -> ApprovedRequest:
    if not 1 <= max_bytes <= RESOURCE_SIZE_LIMIT:
        raise AccessFailure(
            "INVALID_PARAMETER",
            f"max-bytes must be between 1 and {RESOURCE_SIZE_LIMIT}.",
            source_reference=resource.source_references[0],
        )
    url = resolve_resource_url(resource, parameters)
    host = urlsplit(url).hostname
    assert host is not None
    return ApprovedRequest(
        method="GET",
        url=url,
        allowed_hosts=(host,),
        timeout_ms=30_000,
        max_response_bytes=max_bytes,
        max_compressed_response_bytes=max_bytes,
        max_attempts=2,
        retry_status_codes=(408, 429, 500, 502, 503, 504),
        allowed_media_types=(),
        headers={"accept": "*/*"},
    )


def rank_resources(resources: Sequence[DataGovResource]) -> tuple[DataGovResource, ...]:
    access_priority = {
        "ready": 0,
        "parameters-required": 1,
        "insecure-http": 2,
        "invalid-url": 3,
    }
    return tuple(
        sorted(
            resources,
            key=lambda item: (
                access_priority[item.access],
                _FORMAT_PRIORITY.get(item.format, 100),
                item.name.casefold(),
                item.resource_id,
            ),
        )
    )


def select_representative(resources: Sequence[DataGovResource]) -> DataGovResource:
    if not resources:
        raise ValueError("cannot select a representative from an empty resource list")
    return rank_resources(resources)[0]


def render_resource_example(
    resource: DataGovResource,
    language: Literal["curl", "python", "typescript"],
    parameters: Mapping[str, str],
) -> str:
    url = resolve_resource_url(resource, parameters)
    if language == "curl":
        return (
            "curl --fail-with-body --max-time 30 --proto '=https' "
            f"--max-filesize {RESOURCE_SIZE_LIMIT} --remove-on-error --no-clobber "
            f"--output resource.data {shlex.quote(url)}\n"
        )
    if language == "python":
        return f"""from pathlib import Path

import httpx

url = {url!r}
headers = {{"Accept": "*/*", "User-Agent": "hk-open-data-example/1"}}
payload = bytearray()
with httpx.Client(timeout=30, follow_redirects=False) as client:
    with client.stream("GET", url, headers=headers) as response:
        if not 200 <= response.status_code < 300:
            raise RuntimeError(f"provider returned HTTP {{response.status_code}}")
        for chunk in response.iter_bytes():
            if len(payload) + len(chunk) > {RESOURCE_SIZE_LIMIT}:
                raise RuntimeError("resource exceeds the 25 MiB example limit")
            payload.extend(chunk)
with Path("resource.data").open("xb") as output:
    output.write(payload)
"""
    if language == "typescript":
        return f"""import {{ writeFile }} from "node:fs/promises";

const response = await fetch({url!r}, {{
  headers: {{ accept: "*/*", "user-agent": "hk-open-data-example/1" }},
  signal: AbortSignal.timeout(30_000),
  redirect: "manual",
}});
if (!response.ok) throw new Error(`resource returned ${{response.status}}`);
if (!response.body) throw new Error("resource returned no body");
const reader = response.body.getReader();
const chunks = [];
let totalBytes = 0;
while (true) {{
  const {{ done, value }} = await reader.read();
  if (done) break;
  if (!value) continue;
  totalBytes += value.byteLength;
  if (totalBytes > {RESOURCE_SIZE_LIMIT}) {{
    await reader.cancel();
    throw new Error("resource exceeds 25 MiB");
  }}
  chunks.push(value);
}}
const payload = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)), totalBytes);
await writeFile("resource.data", payload, {{ flag: "wx" }});
"""
    raise ValueError("language must be curl, python, or typescript")
