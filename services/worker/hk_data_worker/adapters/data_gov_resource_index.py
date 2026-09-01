from __future__ import annotations

from collections.abc import Mapping

from hk_data_worker.access.errors import access_failure
from hk_data_worker.access.models import AccessRecipe

from .ckan_action import CkanActionAdapter


class DataGovResourceIndexAdapter(CkanActionAdapter):
    """Parse DATA.GOV.HK package metadata that points to the source resources."""

    name = "data-gov-resource-index"

    def validate_document(self, recipe: AccessRecipe, document: object) -> None:
        super().validate_document(recipe, document)
        result = document.get("result") if isinstance(document, Mapping) else None
        if (
            not isinstance(result, Mapping)
            or not isinstance(result.get("id"), str)
            or not isinstance(result.get("resources"), list)
        ):
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SCHEMA_MISMATCH",
                "The DATA.GOV.HK dataset index omitted its resource list.",
            )
