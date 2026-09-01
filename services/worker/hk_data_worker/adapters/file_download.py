from __future__ import annotations

import os
from hashlib import sha256

from hk_data_worker.access.models import AccessRecipe
from hk_data_worker.access.normalization import normalize_records
from hk_data_worker.access.planning import plan_request
from hk_data_worker.connectors.base import SourceRecordDraft
from hk_data_worker.models import ApprovedRequest, FetchResult

from .document import require_media_type


class FileDownloadAdapter:
    name = "file-download"

    def plan(
        self, recipe: AccessRecipe, parameters: dict[str, object]
    ) -> tuple[ApprovedRequest, ...]:
        return plan_request(recipe, parameters, environ=os.environ)

    def parse(
        self, recipe: AccessRecipe, result: FetchResult
    ) -> tuple[SourceRecordDraft, ...]:
        actual_media_type = require_media_type(recipe, result)
        digest = sha256(result.body).hexdigest()
        return normalize_records(
            recipe,
            {
                "byteCount": len(result.body),
                "mediaType": actual_media_type,
                "sha256": digest,
            },
            result,
        )
