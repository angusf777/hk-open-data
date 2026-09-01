from .arcgis_rest import ArcGisRestAdapter
from .base import ADAPTER_NAMES, SourceAdapter
from .ckan_action import CkanActionAdapter
from .csv import CsvAdapter
from .data_gov_resource_index import DataGovResourceIndexAdapter
from .file_download import FileDownloadAdapter
from .odata import ODataAdapter
from .ogc_wfs import OgcWfsAdapter
from .ogc_wms import OgcWmsAdapter
from .rest_json import RestJsonAdapter
from .rss import RssAdapter
from .xml import XmlAdapter

ADAPTERS: dict[str, SourceAdapter] = {
    "ckan-action": CkanActionAdapter(),
    "data-gov-resource-index": DataGovResourceIndexAdapter(),
    "rest-json": RestJsonAdapter(),
    "odata": ODataAdapter(),
    "arcgis-rest": ArcGisRestAdapter(),
    "ogc-wfs": OgcWfsAdapter(),
    "ogc-wms": OgcWmsAdapter(),
    "xml": XmlAdapter(),
    "csv": CsvAdapter(),
    "rss": RssAdapter(),
    "file-download": FileDownloadAdapter(),
}

__all__ = ["ADAPTERS", "ADAPTER_NAMES", "SourceAdapter"]
