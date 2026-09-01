from __future__ import annotations

from typing import Protocol

from hk_data_worker.access.models import AccessRecipe
from hk_data_worker.connectors.base import SourceRecordDraft
from hk_data_worker.models import ApprovedRequest, FetchResult

ADAPTER_NAMES = (
    "ckan-action",
    "rest-json",
    "odata",
    "arcgis-rest",
    "ogc-wfs",
    "ogc-wms",
    "xml",
    "csv",
    "rss",
    "file-download",
)


class SourceAdapter(Protocol):
    name: str

    def plan(
        self, recipe: AccessRecipe, parameters: dict[str, object]
    ) -> tuple[ApprovedRequest, ...]: ...

    def parse(
        self, recipe: AccessRecipe, result: FetchResult
    ) -> tuple[SourceRecordDraft, ...]: ...
