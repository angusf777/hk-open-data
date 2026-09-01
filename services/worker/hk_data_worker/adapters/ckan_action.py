from __future__ import annotations

from collections.abc import Mapping

from hk_data_worker.access.errors import access_failure
from hk_data_worker.access.models import AccessRecipe

from .rest_json import RestJsonAdapter


class CkanActionAdapter(RestJsonAdapter):
    name = "ckan-action"

    def validate_document(self, recipe: AccessRecipe, document: object) -> None:
        if not isinstance(document, Mapping) or document.get("success") is not True:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SOURCE_UNAVAILABLE",
                "The CKAN provider reported failure.",
            )
