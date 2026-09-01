from __future__ import annotations

import json
from collections.abc import Mapping
from datetime import datetime
from hashlib import sha256

from hk_data_worker.connectors.base import SourceRecordDraft
from hk_data_worker.models import FetchResult

from .errors import access_failure
from .models import AccessRecipe
from .selectors import SelectorError, select_json_pointer


def _canonical_bytes(value: object) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode()


def _timestamp(recipe: AccessRecipe, record: Mapping[str, object]) -> datetime | None:
    response = recipe.response
    if response is None or response.timestamp_path is None:
        return None
    try:
        value = select_json_pointer(record, response.timestamp_path)
        if not isinstance(value, str):
            raise ValueError
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            raise ValueError
        return parsed
    except (SelectorError, ValueError) as error:
        raise access_failure(
            recipe.source_reference,
            recipe.recipe_version,
            "SCHEMA_MISMATCH",
            "The declared record timestamp is missing or invalid.",
        ) from error


def _record_key(recipe: AccessRecipe, record: Mapping[str, object], index: int) -> str:
    response = recipe.response
    if response is None or response.id_path is None:
        return str(index)
    try:
        value = select_json_pointer(record, response.id_path)
    except SelectorError:
        return str(index)
    if value is None or isinstance(value, dict | list) or str(value) == "":
        return str(index)
    return str(value)


def _mapped_record(recipe: AccessRecipe, record: Mapping[str, object]) -> dict[str, object]:
    response = recipe.response
    assert response is not None
    fields = response.normalization.fields
    if not fields:
        return {str(key): value for key, value in record.items()}
    mapped: dict[str, object] = {}
    for output_name, pointer in fields.items():
        try:
            mapped[output_name] = select_json_pointer(record, pointer)
        except SelectorError as error:
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SCHEMA_MISMATCH",
                f"The declared normalized field is absent: {output_name}",
            ) from error
    return mapped


def normalize_records(
    recipe: AccessRecipe,
    selected: object,
    result: FetchResult,
) -> tuple[SourceRecordDraft, ...]:
    response = recipe.response
    if response is None:
        raise access_failure(
            recipe.source_reference,
            recipe.recipe_version,
            "RECIPE_NOT_EXECUTABLE",
            "This recipe has no response contract.",
        )
    if isinstance(selected, Mapping):
        items: list[object] = [selected]
    elif isinstance(selected, list):
        items = selected
    else:
        raise access_failure(
            recipe.source_reference,
            recipe.recipe_version,
            "SCHEMA_MISMATCH",
            "The declared record path must select an object or array.",
        )
    raw_hash = sha256(result.body).hexdigest()
    records: list[SourceRecordDraft] = []
    for index, item in enumerate(items):
        if not isinstance(item, Mapping):
            raise access_failure(
                recipe.source_reference,
                recipe.recipe_version,
                "SCHEMA_MISMATCH",
                "A selected record is not an object.",
            )
        source = {str(key): value for key, value in item.items()}
        record_key = _record_key(recipe, source, index)
        data = _mapped_record(recipe, source)
        canonical = _canonical_bytes(data)
        record_hash = sha256(canonical).hexdigest()
        identity = sha256(
            f"{recipe.source_reference}:{record_key}:{record_hash}".encode()
        ).hexdigest()
        records.append(
            SourceRecordDraft(
                source_record_id=f"SR-{identity}",
                source_id=recipe.source_reference,
                source_group_id="access-recipes",
                raw_object_id=f"RAW-{raw_hash}",
                raw_payload_hash=raw_hash,
                record_key=record_key,
                record_data=data,
                record_hash=record_hash,
                language=response.normalization.language,
                observed_at=_timestamp(recipe, source),
            )
        )
    return tuple(records)
