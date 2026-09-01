from __future__ import annotations

import xml.etree.ElementTree as ET

from hk_data_worker.access.errors import access_failure
from hk_data_worker.access.models import AccessRecipe

from .xml import XmlAdapter, _local_name


class OgcWfsAdapter(XmlAdapter):
    name = "ogc-wfs"

    def validate_root(self, recipe: AccessRecipe, root: ET.Element) -> None:
        if _local_name(root.tag).lower() in {"exceptionreport", "serviceexceptionreport"}:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SOURCE_UNAVAILABLE",
                "The WFS provider returned an exception report.",
            )
