from __future__ import annotations

from .address import AddressConnector
from .base import Connector
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

__all__ = ["CONNECTORS"]
