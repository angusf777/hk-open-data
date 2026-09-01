from __future__ import annotations

from pathlib import Path

import pytest
from hk_data_worker.access.errors import AccessFailure
from hk_data_worker.access.planning import plan_request
from hk_data_worker.access.registry import load_recipes

FIXTURES = Path(__file__).parent / "fixtures"


def _recipe(**request_changes: object):
    recipe = load_recipes(FIXTURES / "valid")[0]
    value = recipe.model_dump(mode="json", by_alias=True)
    request = {**value["request"], **request_changes}
    return recipe.model_validate({**value, "request": request})


def test_plans_bounded_request_from_declared_defaults() -> None:
    planned = plan_request(_recipe(), {}, environ={})

    assert len(planned) == 1
    assert planned[0].method == "GET"
    assert planned[0].url == (
        "https://data.gov.hk/en-data/api/3/action/package_list?limit=10&offset=0"
    )
    assert planned[0].timeout_ms == 15_000
    assert planned[0].max_response_bytes == 1_048_576
    assert planned[0].max_attempts == 2
    assert planned[0].allowed_media_types == ("application/json",)


@pytest.mark.parametrize(
    "value",
    ["https://evil.example/x", "../admin", "a&next=https://evil.example"],
)
def test_parameter_cannot_change_allowlisted_host(value: str) -> None:
    recipe = _recipe(
        urlTemplate="https://data.gov.hk/{lang}/items",
        parameters=[
            {
                "name": "lang",
                "location": "path",
                "dataType": "string",
                "required": True,
                "default": "en",
                "example": "en",
                "description": "Response language.",
                "enum": ["en", "tc"],
            }
        ],
    )

    with pytest.raises(AccessFailure) as caught:
        plan_request(recipe, {"lang": value}, environ={})

    assert caught.value.code == "INVALID_PARAMETER"


def test_missing_credential_fails_before_fetch() -> None:
    fixture = _recipe()
    value = fixture.model_dump(mode="json", by_alias=True)
    recipe = fixture.model_validate(
        {
            **value,
            "status": "credential-required",
            "authentication": {
                "type": "api-key",
                "environmentVariables": ["HK_DATA_API_KEY"],
                "setup": "Register with the provider and export HK_DATA_API_KEY.",
            },
            "request": {
                **value["request"],
                "headers": [
                    {
                        "name": "x-api-key",
                        "value": None,
                        "environmentVariable": "HK_DATA_API_KEY",
                    }
                ],
            },
        }
    )

    with pytest.raises(AccessFailure) as caught:
        plan_request(recipe, {}, environ={})

    assert caught.value.code == "AUTH_REQUIRED"
    assert "HK_DATA_API_KEY" in caught.value.message


def test_unknown_parameter_is_rejected() -> None:
    with pytest.raises(AccessFailure) as caught:
        plan_request(_recipe(), {"redirect": "https://evil.example"}, environ={})

    assert caught.value.code == "INVALID_PARAMETER"


@pytest.mark.parametrize("value", [0, 101])
def test_numeric_parameter_outside_declared_bounds_is_rejected(value: int) -> None:
    recipe = _recipe()
    raw = recipe.model_dump(mode="json", by_alias=True)
    parameters = [
        {
            **parameter,
            **({"minimum": 1, "maximum": 100} if parameter["name"] == "limit" else {}),
        }
        for parameter in raw["request"]["parameters"]
    ]
    bounded = recipe.model_validate(
        {**raw, "request": {**raw["request"], "parameters": parameters}}
    )

    with pytest.raises(AccessFailure) as caught:
        plan_request(bounded, {"limit": value}, environ={})

    assert caught.value.code == "INVALID_PARAMETER"


def test_string_parameter_must_match_declared_pattern() -> None:
    recipe = _recipe(
        urlTemplate="https://data.gov.hk/items/{code}",
        parameters=[
            {
                "name": "code",
                "location": "path",
                "dataType": "string",
                "required": True,
                "default": "ABC",
                "example": "ABC",
                "description": "Three-letter source code.",
                "enum": [],
                "pattern": "^[A-Z]{3}$",
            }
        ],
    )

    with pytest.raises(AccessFailure) as caught:
        plan_request(recipe, {"code": "../../admin"}, environ={})

    assert caught.value.code == "INVALID_PARAMETER"
