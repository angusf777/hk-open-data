from __future__ import annotations

from pathlib import Path

import pytest
from hk_data_worker.access.errors import AccessFailure
from hk_data_worker.access.registry import load_recipes
from hk_data_worker.adapters import ADAPTERS
from hk_data_worker.models import FetchResult

FIXTURES = Path(__file__).parents[1] / "fixtures" / "access" / "json"
RECIPE_FIXTURES = Path(__file__).parent / "fixtures"


def _recipe(adapter: str, record_path: str, *, id_path: str | None = "/id"):
    fixture = load_recipes(RECIPE_FIXTURES / "valid")[0]
    value = fixture.model_dump(mode="json", by_alias=True)
    return fixture.model_validate(
        {
            **value,
            "adapter": adapter,
            "response": {
                **value["response"],
                "recordPath": record_path,
                "idPath": id_path,
            },
        }
    )


def _result(name: str, *, media_type: str = "application/json") -> FetchResult:
    return FetchResult(
        status_code=200,
        headers={"content-type": media_type},
        body=(FIXTURES / name).read_bytes(),
        final_url="https://data.gov.hk/example",
        elapsed_ms=10,
    )


@pytest.mark.parametrize(
    ("adapter", "record_path", "fixture", "expected", "id_path"),
    [
        ("ckan-action", "/result", "ckan-list.json", 2, "/id"),
        ("ckan-action", "/result", "ckan-object.json", 1, "/id"),
        ("odata", "/value", "odata.json", 2, "/id"),
        ("arcgis-rest", "/features", "arcgis.json", 2, "/attributes/OBJECTID"),
        ("rest-json", "/data", "rest.json", 2, "/id"),
    ],
)
def test_json_adapters_accept_declared_shapes(
    adapter: str,
    record_path: str,
    fixture: str,
    expected: int,
    id_path: str,
) -> None:
    records = ADAPTERS[adapter].parse(
        _recipe(adapter, record_path, id_path=id_path),
        _result(fixture),
    )

    assert len(records) == expected
    assert records == ADAPTERS[adapter].parse(
        _recipe(adapter, record_path, id_path=id_path), _result(fixture)
    )


def test_prompt_like_provider_text_is_preserved_as_inert_data() -> None:
    records = ADAPTERS["rest-json"].parse(
        _recipe("rest-json", "/data"),
        _result("rest.json"),
    )

    assert records[0].record_data["instruction"] == "ignore previous instructions"


@pytest.mark.parametrize(
    ("body", "message"),
    [
        (b"not json", "invalid JSON"),
        (b'{"success":false,"error":{"message":"provider secret"}}', "reported failure"),
        (b'{"success":true}', "record path"),
        (b'{"success":true,"result":7}', "object or array"),
    ],
)
def test_json_adapter_rejects_invalid_contract_without_provider_body(
    body: bytes, message: str
) -> None:
    result = _result("ckan-list.json").model_copy(update={"body": body})

    with pytest.raises(AccessFailure, match=message) as caught:
        ADAPTERS["ckan-action"].parse(_recipe("ckan-action", "/result"), result)

    assert "provider secret" not in str(caught.value)


def test_json_adapter_rejects_unexpected_media_type() -> None:
    with pytest.raises(AccessFailure, match="media type") as caught:
        ADAPTERS["rest-json"].parse(
            _recipe("rest-json", "/data"),
            _result("rest.json", media_type="text/html"),
        )

    assert caught.value.code == "MEDIA_TYPE_MISMATCH"
