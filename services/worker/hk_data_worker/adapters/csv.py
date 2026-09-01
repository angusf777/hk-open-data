from __future__ import annotations

import csv
import io
import os

from hk_data_worker.access.errors import access_failure
from hk_data_worker.access.models import AccessRecipe
from hk_data_worker.access.normalization import normalize_records
from hk_data_worker.access.planning import plan_request
from hk_data_worker.connectors.base import SourceRecordDraft
from hk_data_worker.models import ApprovedRequest, FetchResult

from .document import require_media_type

MAX_CSV_ROW_BYTES = 1024 * 1024


class CsvAdapter:
    name = "csv"

    def plan(
        self, recipe: AccessRecipe, parameters: dict[str, object]
    ) -> tuple[ApprovedRequest, ...]:
        return plan_request(recipe, parameters, environ=os.environ)

    def parse(
        self, recipe: AccessRecipe, result: FetchResult
    ) -> tuple[SourceRecordDraft, ...]:
        require_media_type(recipe, result)
        if any(len(line) > MAX_CSV_ROW_BYTES for line in result.body.splitlines()):
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SCHEMA_MISMATCH",
                "A CSV row exceeds the parser limit.",
            )
        try:
            text = result.body.decode("utf-8-sig")
            reader = csv.DictReader(io.StringIO(text, newline=""))
            if not reader.fieldnames or any(not name for name in reader.fieldnames):
                raise ValueError("missing CSV header")
            rows = [{str(key): value for key, value in row.items()} for row in reader]
        except (UnicodeDecodeError, csv.Error, ValueError) as error:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SCHEMA_MISMATCH",
                "The provider returned invalid CSV.",
            ) from error
        return normalize_records(recipe, rows, result)
