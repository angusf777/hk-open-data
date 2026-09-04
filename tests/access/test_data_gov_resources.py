from __future__ import annotations

import ast
import json
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import pytest
from hk_data_worker.access.errors import AccessFailure
from hk_data_worker.access.resources import (
    DataGovResourceInventory,
    build_resource,
    render_resource_example,
    resolve_resource_url,
    resource_request,
    resources_for_source,
    select_representative,
)


def _resource(**changes: object):
    raw = {
        "id": "resource-one",
        "name": "Current routes",
        "format": "JSON",
        "url": "https://api.example.hk/routes/{routeId}?language={language}",
    }
    raw.update(changes)
    return build_resource("dataset-one", ("HKAPI-030",), raw)


def test_inventory_normalizes_current_ckan_resource_metadata() -> None:
    resource = _resource()

    assert resource.model_dump(mode="json", by_alias=True) == {
        "schemaVersion": 1,
        "sourceReferences": ["HKAPI-030"],
        "datasetId": "dataset-one",
        "resourceId": "resource-one",
        "name": "Current routes",
        "format": "JSON",
        "urlTemplate": "https://api.example.hk/routes/{routeId}?language={language}",
        "templateParameters": ["routeId", "language"],
        "access": "parameters-required",
        "transport": "https",
        "resourceKind": "api",
    }


@pytest.mark.parametrize(
    ("url", "format_name", "expected"),
    [
        ("https://data.gov.hk/en-data/dataset/example", "JSON", "dataset-page"),
        ("https://portal.csdi.gov.hk/geoportal/?id=example", "GML", "geoportal"),
        ("https://example.hk/data.csv", "CSV", "file"),
        ("https://example.hk/rest/current", "API", "api"),
        ("https://example.hk/about.html", "HTML", "web-page"),
    ],
)
def test_resource_kind_distinguishes_payloads_from_web_pages(
    url: str, format_name: str, expected: str
) -> None:
    resource = _resource(url=url, format=format_name)

    assert resource.resource_kind == expected


def test_resource_request_refuses_dataset_landing_page() -> None:
    resource = _resource(
        url="https://data.gov.hk/en-data/dataset/hk-epd-lamppost-air-quality-lamppost",
        format="JSON",
    )

    with pytest.raises(AccessFailure, match="direct file or API") as caught:
        resource_request(resource, {}, max_bytes=65_536)
    assert caught.value.code == "RESOURCE_NOT_DIRECT"


def test_resolver_requires_every_placeholder_and_encodes_values() -> None:
    resource = _resource()

    with pytest.raises(AccessFailure, match="routeId") as missing:
        resolve_resource_url(resource, {})
    assert missing.value.code == "INVALID_PARAMETER"

    with pytest.raises(AccessFailure, match="Unsupported parameter"):
        resolve_resource_url(
            resource,
            {"routeId": "1", "language": "en", "redirect": "https://evil.example"},
        )

    assert (
        resolve_resource_url(
            resource,
            {"routeId": "A/B", "language": "zh HK"},
        )
        == "https://api.example.hk/routes/A%2FB?language=zh%20HK"
    )


def test_resolver_supports_provider_angle_bracket_placeholders() -> None:
    resource = _resource(url="https://api.example.hk/flights?date=<date>&route=<routecode>")

    assert resource.access == "parameters-required"
    assert resource.template_parameters == ("date", "routecode")
    assert (
        resolve_resource_url(resource, {"date": "2026-09-03", "routecode": "A/B"})
        == "https://api.example.hk/flights?date=2026-09-03&route=A%2FB"
    )


def test_resource_request_is_https_host_allowlisted_and_bounded() -> None:
    resource = _resource(url="https://data.example.hk/current.csv", format="CSV")

    request = resource_request(resource, {}, max_bytes=65_536)

    assert request.url == "https://data.example.hk/current.csv"
    assert request.allowed_hosts == ("data.example.hk",)
    assert request.max_response_bytes == 65_536
    assert request.max_compressed_response_bytes == 65_536
    assert request.headers == {"accept": "*/*"}


def test_resource_request_refuses_http_only_provider_metadata() -> None:
    resource = _resource(url="http://legacy.example.hk/data.csv", format="CSV")

    assert resource.access == "insecure-http"
    with pytest.raises(AccessFailure, match="HTTPS") as caught:
        resource_request(resource, {}, max_bytes=65_536)
    assert caught.value.code == "UNSAFE_RESOURCE_URL"


def test_source_filter_rejects_dataset_outside_reviewed_mapping() -> None:
    first = _resource(url="https://example.hk/one.json")
    second = build_resource(
        "dataset-two",
        ("HKAPI-031",),
        {
            "id": "resource-two",
            "name": "Second",
            "format": "CSV",
            "url": "https://example.hk/two.csv",
        },
    )
    inventory = DataGovResourceInventory(
        schema_version=1,
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        package_endpoint="https://data.gov.hk/en-data/api/3/action/package_show",
        resources=(first, second),
    )

    assert resources_for_source(inventory, "HKAPI-030") == (first,)
    with pytest.raises(AccessFailure, match="dataset-two") as caught:
        resources_for_source(inventory, "HKAPI-030", dataset_id="dataset-two")
    assert caught.value.code == "INVALID_PARAMETER"


def test_representative_prefers_concrete_structured_https_resource() -> None:
    resources = (
        _resource(id="image", url="https://example.hk/camera.jpg", format="JPEG"),
        _resource(id="http", url="http://example.hk/current.json", format="JSON"),
        _resource(id="template", url="https://example.hk/{id}.json", format="JSON"),
        _resource(id="csv", url="https://example.hk/current.csv", format="CSV"),
        _resource(id="json", url="https://example.hk/current.json", format="JSON"),
    )

    assert select_representative(resources).resource_id == "json"


def test_resource_examples_are_copyable_and_use_the_resolved_url(tmp_path: Path) -> None:
    resource = _resource(url="https://data.example.hk/current.json", format="JSON")

    curl = render_resource_example(resource, "curl", {})
    python = render_resource_example(resource, "python", {})
    typescript = render_resource_example(resource, "typescript", {})

    assert "https://data.example.hk/current.json" in curl
    assert "--max-filesize 26214400" in curl
    assert "--location" not in curl
    assert "--no-clobber" in curl
    ast.parse(python)
    assert "follow_redirects=False" in python
    assert 'open("xb")' in python
    assert "iter_bytes()" in python
    assert "arrayBuffer" not in typescript
    assert "response.body.getReader()" in typescript
    assert 'flag: "wx"' in typescript
    script = tmp_path / "resource-example.mjs"
    script.write_text(typescript, encoding="utf-8")
    subprocess.run(["node", "--check", str(script)], check=True)


def test_inventory_json_has_stable_public_shape() -> None:
    inventory = DataGovResourceInventory(
        schema_version=1,
        checked_at=datetime(2026, 9, 3, tzinfo=UTC),
        package_endpoint="https://data.gov.hk/en-data/api/3/action/package_show",
        resources=(_resource(url="https://example.hk/data.json"),),
    )

    value = json.loads(inventory.model_dump_json(by_alias=True))
    assert value["schemaVersion"] == 1
    assert value["resources"][0]["resourceId"] == "resource-one"
