from __future__ import annotations

from ..models import RawObjectRef
from .base import Connector, ConnectorDefinition, SourceRecordDraft, require_list


class AddressConnector(Connector):
    source_group_id = "P01-SG-10"

    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]:
        payload = self.parse_json(body, error_code="ADDRESS_JSON_INVALID")
        return self.records(
            definition,
            raw,
            require_list(payload.get("SuggestedAddress"), error_code="ADDRESS_RESULTS_INVALID"),
            error_code="ADDRESS_RECORD_INVALID",
        )
