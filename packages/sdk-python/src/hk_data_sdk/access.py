from __future__ import annotations

from collections.abc import Mapping
from typing import Literal, TypedDict

AccessExampleLanguage = Literal["curl", "python", "typescript"]


class AccessExamples(TypedDict):
    curl: str | None
    python: str | None
    typescript: str | None


class AccessRecipe(TypedDict, total=False):
    source_reference: str
    recipe_version: str
    adapter: str
    status: str
    effective_status: str
    documentation_url: str
    examples: AccessExamples


def access_example(recipe: Mapping[str, object], language: str) -> str:
    if language not in {"curl", "python", "typescript"}:
        raise ValueError("language must be curl, python, or typescript")
    examples = recipe.get("examples")
    if not isinstance(examples, Mapping):
        raise RuntimeError("API returned an invalid access recipe")
    value = examples.get(language)
    if not isinstance(value, str) or value == "":
        raise ValueError(f"{language} example is not available for this source")
    return value
