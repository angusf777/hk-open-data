from __future__ import annotations

from ..models import RawObjectRef
from .base import Connector, ConnectorDefinition, SourceRecordDraft, require_list


class DataGovArchiveConnector(Connector):
    source_group_id = "P01-SG-02"

    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]:
        payload = self.parse_json(body, error_code="DATAGOV_JSON_INVALID")
        return self.records(
            definition,
            raw,
            require_list(payload.get("files"), error_code="DATAGOV_FILES_INVALID"),
            error_code="DATAGOV_RECORD_INVALID",
        )
