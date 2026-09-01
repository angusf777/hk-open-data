from __future__ import annotations

from hk_data_worker.access.registry import REPOSITORY_ROOT, load_recipes

from .address import AddressConnector
from .base import Connector, RecipeConnector
from .ckan import CkanConnector
from .companies import CompaniesConnector
from .csd import CsdConnector
from .csdi_catalog import CsdiCatalogConnector
from .csdi_spatial import CsdiSpatialConnector
from .datagov import DataGovArchiveConnector
from .hkma import HkmaConnector
from .hko import HkoConnector
from .legco import LegcoConnector

CONNECTORS: dict[str, Connector] = {
    connector.source_group_id: connector
    for connector in (
        CkanConnector(),
        DataGovArchiveConnector(),
        CsdiCatalogConnector(),
        CsdiSpatialConnector(),
        HkoConnector(),
        CsdConnector(),
        HkmaConnector(),
        CompaniesConnector(),
        LegcoConnector(),
        AddressConnector(),
    )
}

RECIPE_CONNECTORS: dict[str, RecipeConnector] = {
    recipe.source_reference: RecipeConnector(recipe)
    for recipe in load_recipes(REPOSITORY_ROOT / "access" / "recipes" / "official")
}

__all__ = ["CONNECTORS", "RECIPE_CONNECTORS"]
