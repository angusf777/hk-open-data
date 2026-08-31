from __future__ import annotations

from datetime import datetime

from ..models import RawObjectRef
from .base import Connector, ConnectorDefinition, SourceRecordDraft


class HkoConnector(Connector):
    source_group_id = "P01-SG-05"

    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]:
        payload = self.parse_json(body, error_code="HKO_JSON_INVALID")
        records = self.records(definition, raw, [payload], error_code="HKO_RECORD_INVALID")
        provider_time = payload.get("updateTime")
        if not isinstance(provider_time, str):
            return records
        try:
            observed_at = datetime.fromisoformat(provider_time)
        except ValueError:
            return records
        return tuple(record.model_copy(update={"observed_at": observed_at}) for record in records)
