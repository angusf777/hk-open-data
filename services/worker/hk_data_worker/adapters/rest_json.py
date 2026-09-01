from __future__ import annotations

import json
import os

from hk_data_worker.access.errors import access_failure
from hk_data_worker.access.models import AccessRecipe
from hk_data_worker.access.normalization import normalize_records
from hk_data_worker.access.planning import plan_request
from hk_data_worker.access.selectors import SelectorError, select_json_pointer
from hk_data_worker.connectors.base import SourceRecordDraft
from hk_data_worker.models import ApprovedRequest, FetchResult


class RestJsonAdapter:
    name = "rest-json"

    def plan(
        self, recipe: AccessRecipe, parameters: dict[str, object]
    ) -> tuple[ApprovedRequest, ...]:
        return plan_request(recipe, parameters, environ=os.environ)

    def validate_document(self, recipe: AccessRecipe, document: object) -> None:
        del recipe, document

    def parse(
        self, recipe: AccessRecipe, result: FetchResult
    ) -> tuple[SourceRecordDraft, ...]:
        response = recipe.response
        if response is None:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "RECIPE_NOT_EXECUTABLE",
                "This recipe has no response contract.",
            )
        content_type = result.headers.get("content-type", "").partition(";")[0].lower()
        if content_type not in {value.lower() for value in response.media_types}:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "MEDIA_TYPE_MISMATCH",
                "The provider response media type does not match the recipe.",
            )
        try:
            document = json.loads(result.body)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SCHEMA_MISMATCH",
                "The provider returned invalid JSON.",
            ) from error
        self.validate_document(recipe, document)
        try:
            selected = select_json_pointer(document, response.record_path)
        except SelectorError as error:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SCHEMA_MISMATCH",
                "The declared record path is absent.",
            ) from error
        return normalize_records(recipe, selected, result)
