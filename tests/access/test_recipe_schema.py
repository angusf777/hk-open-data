from __future__ import annotations

import json
from pathlib import Path

import pytest
import yaml
from hk_data_worker.access.registry import RecipeRegistryError, load_recipes
from jsonschema import Draft202012Validator, FormatChecker

FIXTURES = Path(__file__).parent / "fixtures"
SCHEMA_PATH = Path("access/schemas/access-recipe.schema.json")


def _valid_recipe_data() -> dict[str, object]:
    value = yaml.safe_load((FIXTURES / "valid" / "hkapi-001.yml").read_text(encoding="utf-8"))
    assert isinstance(value, dict)
    return value


def _write_recipe(path: Path, value: dict[str, object]) -> None:
    path.write_text(yaml.safe_dump(value, sort_keys=False), encoding="utf-8")


def test_valid_executable_recipe_loads_with_camel_case_contract_fields() -> None:
    recipes = load_recipes(FIXTURES / "valid")

    assert len(recipes) == 1
    assert recipes[0].source_reference == "HKAPI-001"
    assert recipes[0].request is not None
    assert recipes[0].request.allowed_hosts == ("data.gov.hk",)
    assert recipes[0].model_dump(by_alias=True)["sourceReference"] == "HKAPI-001"


def test_recipe_rejects_fixed_authorization_credentials() -> None:
    with pytest.raises(RecipeRegistryError, match="credential values are forbidden"):
        load_recipes(FIXTURES / "invalid")


def test_registry_rejects_duplicate_source_references(tmp_path: Path) -> None:
    value = _valid_recipe_data()
    _write_recipe(tmp_path / "first.yml", value)
    _write_recipe(tmp_path / "second.yml", value)

    with pytest.raises(RecipeRegistryError, match="duplicate sourceReference: HKAPI-001"):
        load_recipes(tmp_path)


def test_request_rejects_initial_host_outside_allowlist(tmp_path: Path) -> None:
    value = _valid_recipe_data()
    request = value["request"]
    assert isinstance(request, dict)
    request["allowedHosts"] = ["api.example.gov.hk"]
    _write_recipe(tmp_path / "recipe.yml", value)

    with pytest.raises(RecipeRegistryError, match="initial request host must be allowlisted"):
        load_recipes(tmp_path)


def test_manual_only_recipe_cannot_retain_an_executable_request(tmp_path: Path) -> None:
    value = _valid_recipe_data()
    value["adapter"] = "none"
    value["status"] = "manual-only"
    value["reason"] = "The provider publishes an interactive page only."
    value["nextAction"] = "Use the provider page manually."
    _write_recipe(tmp_path / "recipe.yml", value)

    with pytest.raises(RecipeRegistryError, match="manual-only recipes cannot define a request"):
        load_recipes(tmp_path)


def test_public_json_schema_accepts_valid_recipe_and_rejects_fixed_credentials() -> None:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema, format_checker=FormatChecker())
    valid = _valid_recipe_data()
    invalid = yaml.safe_load(
        (FIXTURES / "invalid" / "credential-value.yml").read_text(encoding="utf-8")
    )

    assert list(validator.iter_errors(valid)) == []
    assert any(
        "Authorization" in error.message or "Bearer actual-secret-value" in error.message
        for error in validator.iter_errors(invalid)
    )


def test_runtime_loader_enforces_the_public_json_schema(tmp_path: Path) -> None:
    value = _valid_recipe_data()
    value["limitations"] = []
    _write_recipe(tmp_path / "recipe.yml", value)

    with pytest.raises(RecipeRegistryError, match=r"limitations: \[\] should be non-empty"):
        load_recipes(tmp_path)


def test_fixture_tested_recipe_requires_request_response_and_adapter(tmp_path: Path) -> None:
    value = _valid_recipe_data()
    value["adapter"] = "none"
    value["request"] = None
    value["response"] = None
    _write_recipe(tmp_path / "recipe.yml", value)

    with pytest.raises(RecipeRegistryError, match="fixture-tested recipes require a request"):
        load_recipes(tmp_path)


def test_manual_only_recipe_requires_reason_and_next_action(tmp_path: Path) -> None:
    value = _valid_recipe_data()
    value.update(
        {
            "adapter": "none",
            "status": "manual-only",
            "request": None,
            "response": None,
            "reason": None,
            "nextAction": None,
        }
    )
    _write_recipe(tmp_path / "recipe.yml", value)

    with pytest.raises(RecipeRegistryError, match="manual-only recipes require a reason"):
        load_recipes(tmp_path)


def test_credential_required_recipe_requires_environment_setup(tmp_path: Path) -> None:
    value = _valid_recipe_data()
    value["status"] = "credential-required"
    value["authentication"] = {
        "type": "bearer",
        "environmentVariables": [],
        "setup": None,
    }
    _write_recipe(tmp_path / "recipe.yml", value)

    with pytest.raises(
        RecipeRegistryError,
        match="credential-required recipes require environment variables and setup instructions",
    ):
        load_recipes(tmp_path)


@pytest.mark.parametrize(
    "url",
    [
        "https://user:password@data.gov.hk/en-data/api/3/action/package_list",
        "https://data.gov.hk:8443/en-data/api/3/action/package_list",
        "https://data.gov.hk/en-data/api/3/action/package_list#fragment",
    ],
)
def test_request_rejects_credentialed_nonstandard_or_fragmented_urls(
    tmp_path: Path, url: str
) -> None:
    value = _valid_recipe_data()
    request = value["request"]
    assert isinstance(request, dict)
    request["urlTemplate"] = url
    _write_recipe(tmp_path / "recipe.yml", value)

    with pytest.raises(RecipeRegistryError, match="credential-free HTTPS URL on port 443"):
        load_recipes(tmp_path)


def test_request_rejects_duplicate_parameter_names(tmp_path: Path) -> None:
    value = _valid_recipe_data()
    request = value["request"]
    assert isinstance(request, dict)
    parameters = request["parameters"]
    assert isinstance(parameters, list)
    parameters.append(dict(parameters[0]))
    _write_recipe(tmp_path / "recipe.yml", value)

    with pytest.raises(RecipeRegistryError, match="parameter names must be unique"):
        load_recipes(tmp_path)
