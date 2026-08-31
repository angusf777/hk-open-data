from __future__ import annotations

from ..models import RawObjectRef
from .base import (
    Connector,
    ConnectorDefinition,
    QuarantineRequired,
    SourceRecordDraft,
    require_list,
)


class HkmaConnector(Connector):
    source_group_id = "P01-SG-07"

    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]:
        payload = self.parse_json(body, error_code="HKMA_JSON_INVALID")
        result = payload.get("result")
        if not isinstance(result, dict):
            raise QuarantineRequired("HKMA_RESULT_INVALID")
        return self.records(
            definition,
            raw,
            require_list(result.get("records"), error_code="HKMA_RECORDS_INVALID"),
            error_code="HKMA_RECORD_INVALID",
        )
