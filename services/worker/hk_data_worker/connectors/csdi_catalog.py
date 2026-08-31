from __future__ import annotations

from ..models import RawObjectRef
from .base import Connector, ConnectorDefinition, SourceRecordDraft, require_list


class CsdiCatalogConnector(Connector):
    source_group_id = "P01-SG-03"

    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]:
        payload = self.parse_json(body, error_code="CSDI_CATALOG_JSON_INVALID")
        return self.records(
            definition,
            raw,
            require_list(payload.get("datasets"), error_code="CSDI_DATASETS_INVALID"),
            error_code="CSDI_DATASET_INVALID",
        )
