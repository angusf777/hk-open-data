from __future__ import annotations

import os
import re
import xml.etree.ElementTree as ET

from hk_data_worker.access.errors import access_failure
from hk_data_worker.access.models import AccessRecipe
from hk_data_worker.access.normalization import normalize_records
from hk_data_worker.access.planning import plan_request
from hk_data_worker.connectors.base import SourceRecordDraft
from hk_data_worker.models import ApprovedRequest, FetchResult

from .document import require_media_type

SAFE_SELECTOR = re.compile(r"^(\.|\.//[A-Za-z_][A-Za-z0-9_.-]*)$")


def _local_name(tag: str) -> str:
    return tag.rpartition("}")[2] if "}" in tag else tag


def _element_data(element: ET.Element) -> dict[str, object]:
    data: dict[str, object] = {f"@{key}": value for key, value in sorted(element.attrib.items())}
    text = (element.text or "").strip()
    if text:
        data["text"] = text
    for child in element:
        name = _local_name(child.tag)
        value = _element_data(child)
        existing = data.get(name)
        if existing is None:
            data[name] = value
        elif isinstance(existing, list):
            existing.append(value)
        else:
            data[name] = [existing, value]
    return data


def parse_xml_root(recipe: AccessRecipe, result: FetchResult) -> ET.Element:
    require_media_type(recipe, result)
    lowered = result.body.lower()
    if b"<!doctype" in lowered or b"<!entity" in lowered:
        raise access_failure(
            recipe.source_reference,
            recipe.recipe_version,
            "SCHEMA_MISMATCH",
            "XML document type and entity declarations are forbidden.",
        )
    try:
        return ET.fromstring(result.body)
    except ET.ParseError as error:
        raise access_failure(
            recipe.source_reference,
            recipe.recipe_version,
            "SCHEMA_MISMATCH",
            "The provider returned malformed XML.",
        ) from error


def select_xml(recipe: AccessRecipe, root: ET.Element) -> list[dict[str, object]]:
    response = recipe.response
    assert response is not None
    selector = response.record_path
    if not SAFE_SELECTOR.fullmatch(selector):
        raise access_failure(
            recipe.source_reference,
            recipe.recipe_version,
            "SCHEMA_MISMATCH",
            "The recipe uses an unsupported XML selector.",
        )
    if selector == ".":
        elements = [root]
    else:
        wanted = selector.removeprefix(".//")
        elements = [element for element in root.iter() if _local_name(element.tag) == wanted]
    return [_element_data(element) for element in elements]


class XmlAdapter:
    name = "xml"

    def plan(
        self, recipe: AccessRecipe, parameters: dict[str, object]
    ) -> tuple[ApprovedRequest, ...]:
        return plan_request(recipe, parameters, environ=os.environ)

    def validate_root(self, recipe: AccessRecipe, root: ET.Element) -> None:
        del recipe, root

    def parse(
        self, recipe: AccessRecipe, result: FetchResult
    ) -> tuple[SourceRecordDraft, ...]:
        root = parse_xml_root(recipe, result)
        self.validate_root(recipe, root)
        return normalize_records(recipe, select_xml(recipe, root), result)
