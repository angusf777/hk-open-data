from __future__ import annotations

from ..models import RawObjectRef
from .base import (
    Connector,
    ConnectorDefinition,
    QuarantineRequired,
    SourceRecordDraft,
    require_list,
)


class CkanConnector(Connector):
    source_group_id = "P01-SG-01"

    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]:
        payload = self.parse_json(body, error_code="CKAN_JSON_INVALID")
        if payload.get("success") is not True:
            raise QuarantineRequired("CKAN_RESPONSE_UNSUCCESSFUL")
        return self.records(
            definition,
            raw,
            require_list(payload.get("result"), error_code="CKAN_RESULT_INVALID"),
            error_code="CKAN_RECORD_INVALID",
        )
