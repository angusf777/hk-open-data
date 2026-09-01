from .arcgis_rest import ArcGisRestAdapter
from .base import ADAPTER_NAMES, SourceAdapter
from .ckan_action import CkanActionAdapter
from .odata import ODataAdapter
from .rest_json import RestJsonAdapter

ADAPTERS: dict[str, SourceAdapter] = {
    "ckan-action": CkanActionAdapter(),
    "rest-json": RestJsonAdapter(),
    "odata": ODataAdapter(),
    "arcgis-rest": ArcGisRestAdapter(),
}

__all__ = ["ADAPTERS", "ADAPTER_NAMES", "SourceAdapter"]
