from __future__ import annotations

from ..models import RawObjectRef
from .base import Connector, ConnectorDefinition, SourceRecordDraft, require_list


class CsdConnector(Connector):
    source_group_id = "P01-SG-06"

    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]:
        payload = self.parse_json(body, error_code="CSD_JSON_INVALID")
        return self.records(
            definition,
            raw,
            require_list(payload.get("data"), error_code="CSD_DATA_INVALID"),
            error_code="CSD_RECORD_INVALID",
        )
