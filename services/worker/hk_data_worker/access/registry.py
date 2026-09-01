from __future__ import annotations

import json
from pathlib import Path

import jsonschema
import yaml
from jsonschema import Draft202012Validator, FormatChecker
from pydantic import ValidationError

from .models import AccessRecipe


class RecipeRegistryError(ValueError):
    """A recipe registry cannot be loaded safely."""


class RecipeLoader(yaml.SafeLoader):
    """Safe YAML loader that keeps ISO-looking values as strings."""


RecipeLoader.yaml_implicit_resolvers = {
    key: [(tag, pattern) for tag, pattern in resolvers if tag != "tag:yaml.org,2002:timestamp"]
    for key, resolvers in yaml.SafeLoader.yaml_implicit_resolvers.items()
}

REPOSITORY_ROOT = Path(__file__).resolve().parents[4]
SCHEMA_PATH = REPOSITORY_ROOT / "access" / "schemas" / "access-recipe.schema.json"


def _schema_validator() -> Draft202012Validator:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema, format_checker=FormatChecker())


def _schema_error(error: jsonschema.ValidationError) -> str:
    location = ".".join(str(part) for part in error.absolute_path) or "recipe"
    return f"{location}: {error.message}"


def load_recipes(root: Path) -> tuple[AccessRecipe, ...]:
    recipes: list[AccessRecipe] = []
    seen_references: set[str] = set()
    try:
        validator = _schema_validator()
        paths = sorted(root.rglob("*.yml"))
        for path in paths:
            value = yaml.load(path.read_text(encoding="utf-8"), Loader=RecipeLoader)
            recipe = AccessRecipe.model_validate(value)
            errors = sorted(validator.iter_errors(value), key=lambda error: list(error.path))
            if errors:
                raise RecipeRegistryError(_schema_error(errors[0]))
            if recipe.source_reference in seen_references:
                raise RecipeRegistryError(
                    f"duplicate sourceReference: {recipe.source_reference}"
                )
            seen_references.add(recipe.source_reference)
            recipes.append(recipe)
    except (OSError, yaml.YAMLError, json.JSONDecodeError, ValidationError) as error:
        raise RecipeRegistryError(str(error)) from error
    return tuple(sorted(recipes, key=lambda recipe: recipe.source_reference))
