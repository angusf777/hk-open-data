from __future__ import annotations

import json
from urllib.parse import urljoin

from ..models import ApprovedRequest, FetchResult
from .base import ConnectorPagination, QuarantineRequired


def _pointer(document: object, pointer: str) -> object:
    current = document
    for encoded in pointer.removeprefix("/").split("/"):
        key = encoded.replace("~1", "/").replace("~0", "~")
        if isinstance(current, dict) and key in current:
            current = current[key]
            continue
        raise QuarantineRequired("PAGINATION_POINTER_MISSING")
    return current


def next_page_request(
    request: ApprovedRequest,
    response: FetchResult,
    pagination: ConnectorPagination,
    *,
    completed_pages: int,
    seen_urls: set[str],
) -> ApprovedRequest | None:
    try:
        document = json.loads(response.body)
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        raise QuarantineRequired("PAGINATION_DOCUMENT_INVALID") from error
    next_value = _pointer(document, pagination.next_url_pointer)
    if next_value is None or next_value == "":
        return None
    if not isinstance(next_value, str):
        raise QuarantineRequired("PAGINATION_NEXT_URL_INVALID")
    if completed_pages >= pagination.max_pages:
        raise QuarantineRequired("PAGINATION_PAGE_LIMIT_EXCEEDED")
    next_url = urljoin(response.final_url, next_value)
    if next_url in seen_urls:
        raise QuarantineRequired("PAGINATION_CURSOR_LOOP")
    try:
        planned = request.model_copy(update={"url": next_url})
        return ApprovedRequest.model_validate(planned.model_dump())
    except ValueError as error:
        raise QuarantineRequired("PAGINATION_NEXT_URL_INVALID") from error
