from __future__ import annotations

from collections.abc import Mapping

from hk_data_worker.access.errors import access_failure
from hk_data_worker.access.models import AccessRecipe

from .rest_json import RestJsonAdapter


class ArcGisRestAdapter(RestJsonAdapter):
    name = "arcgis-rest"

    def validate_document(self, recipe: AccessRecipe, document: object) -> None:
        if isinstance(document, Mapping) and "error" in document:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SOURCE_UNAVAILABLE",
                "The ArcGIS provider reported failure.",
            )
