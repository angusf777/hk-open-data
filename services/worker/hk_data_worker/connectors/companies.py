from __future__ import annotations

from ..models import RawObjectRef
from .base import Connector, ConnectorDefinition, SourceRecordDraft, require_list


class CompaniesConnector(Connector):
    source_group_id = "P01-SG-08"

    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]:
        payload = self.parse_json(body, error_code="COMPANIES_JSON_INVALID")
        return self.records(
            definition,
            raw,
            require_list(payload.get("datasets"), error_code="COMPANIES_DATASETS_INVALID"),
            error_code="COMPANIES_RECORD_INVALID",
        )
