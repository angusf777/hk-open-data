from __future__ import annotations

from ..models import RawObjectRef
from .base import (
    Connector,
    ConnectorDefinition,
    QuarantineRequired,
    SourceRecordDraft,
    require_list,
)


class CsdiSpatialConnector(Connector):
    source_group_id = "P01-SG-04"

    def parse(
        self, definition: ConnectorDefinition, raw: RawObjectRef, body: bytes
    ) -> tuple[SourceRecordDraft, ...]:
        payload = self.parse_json(body, error_code="CSDI_SPATIAL_JSON_INVALID")
        if payload.get("type") != "FeatureCollection":
            raise QuarantineRequired("CSDI_FEATURE_COLLECTION_INVALID")
        return self.records(
            definition,
            raw,
            require_list(payload.get("features"), error_code="CSDI_FEATURES_INVALID"),
            error_code="CSDI_FEATURE_INVALID",
        )
