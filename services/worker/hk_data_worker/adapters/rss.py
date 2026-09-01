from __future__ import annotations

import xml.etree.ElementTree as ET

from hk_data_worker.access.errors import access_failure
from hk_data_worker.access.models import AccessRecipe

from .xml import XmlAdapter, _local_name


class RssAdapter(XmlAdapter):
    name = "rss"

    def validate_root(self, recipe: AccessRecipe, root: ET.Element) -> None:
        if _local_name(root.tag).lower() not in {"rss", "feed"}:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SCHEMA_MISMATCH",
                "The provider response is not an RSS or Atom feed.",
            )
