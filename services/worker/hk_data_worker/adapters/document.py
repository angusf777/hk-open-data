from __future__ import annotations

from hk_data_worker.access.errors import access_failure
from hk_data_worker.access.models import AccessRecipe
from hk_data_worker.models import FetchResult


def media_type(result: FetchResult) -> str:
    return result.headers.get("content-type", "").partition(";")[0].strip().lower()


def require_media_type(recipe: AccessRecipe, result: FetchResult) -> str:
    response = recipe.response
    if response is None:
        raise access_failure(
            recipe.source_reference,
            recipe.recipe_version,
            "RECIPE_NOT_EXECUTABLE",
            "This recipe has no response contract.",
        )
    actual = media_type(result)
    if actual not in {value.lower() for value in response.media_types}:
        raise access_failure(
            recipe.source_reference,
            recipe.recipe_version,
            "MEDIA_TYPE_MISMATCH",
            "The provider response media type does not match the recipe.",
        )
    return actual
