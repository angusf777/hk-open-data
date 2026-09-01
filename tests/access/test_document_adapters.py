from __future__ import annotations

from pathlib import Path

import pytest
from hk_data_worker.access.errors import AccessFailure
from hk_data_worker.access.registry import load_recipes
from hk_data_worker.adapters import ADAPTER_NAMES, ADAPTERS
from hk_data_worker.models import FetchResult

FIXTURES = Path(__file__).parents[1] / "fixtures" / "access" / "documents"
RECIPE_FIXTURES = Path(__file__).parent / "fixtures"


def _recipe(
    adapter: str,
    record_path: str,
    media_type: str,
    *,
    id_path: str | None,
):
    fixture = load_recipes(RECIPE_FIXTURES / "valid")[0]
    value = fixture.model_dump(mode="json", by_alias=True)
    return fixture.model_validate(
        {
            **value,
            "adapter": adapter,
            "response": {
                **value["response"],
                "mediaTypes": [media_type],
                "recordPath": record_path,
                "idPath": id_path,
            },
        }
    )


def _result(name: str, media_type: str) -> FetchResult:
    return FetchResult(
        status_code=200,
        headers={"content-type": media_type},
        body=(FIXTURES / name).read_bytes(),
        final_url="https://data.gov.hk/example",
        elapsed_ms=10,
    )


@pytest.mark.parametrize(
    ("adapter", "fixture", "record_path", "media_type", "id_path", "expected"),
    [
        ("xml", "records.xml", ".//record", "application/xml", "/id/text", 2),
        ("csv", "records.csv", "*", "text/csv", "/id", 2),
        ("rss", "feed.xml", ".//item", "application/rss+xml", "/guid/text", 2),
        (
            "file-download",
            "document.bin",
            "",
            "application/octet-stream",
            None,
            1,
        ),
        (
            "ogc-wfs",
            "feature-collection.xml",
            ".//featureMember",
            "application/xml",
            "/id/text",
            2,
        ),
        ("ogc-wms", "capabilities.xml", ".", "application/xml", None, 1),
    ],
)
def test_document_adapter_contract(
    adapter: str,
    fixture: str,
    record_path: str,
    media_type: str,
    id_path: str | None,
    expected: int,
) -> None:
    records = ADAPTERS[adapter].parse(
        _recipe(adapter, record_path, media_type, id_path=id_path),
        _result(fixture, media_type),
    )

    assert len(records) == expected


def test_adapter_registry_has_exactly_the_ten_public_adapters() -> None:
    assert tuple(ADAPTERS) == ADAPTER_NAMES


@pytest.mark.parametrize(
    "body",
    [
        b'<!DOCTYPE records [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><records/>',
        b"<records><unclosed></records>",
    ],
)
def test_xml_rejects_entities_and_malformed_documents(body: bytes) -> None:
    result = _result("records.xml", "application/xml").model_copy(update={"body": body})

    with pytest.raises(AccessFailure, match="XML"):
        ADAPTERS["xml"].parse(
            _recipe("xml", ".//record", "application/xml", id_path="/id/text"),
            result,
        )


def test_file_download_emits_metadata_not_provider_bytes() -> None:
    result = _result("document.bin", "application/octet-stream")
    record = ADAPTERS["file-download"].parse(
        _recipe("file-download", "", "application/octet-stream", id_path=None),
        result,
    )[0]

    assert record.record_data == {
        "byteCount": len(result.body),
        "mediaType": "application/octet-stream",
        "sha256": record.raw_payload_hash,
    }
    assert result.body.decode().strip() not in str(record.record_data)


def test_wfs_exception_report_is_rejected_without_provider_text() -> None:
    body = b"<ExceptionReport><ExceptionText>provider secret</ExceptionText></ExceptionReport>"
    result = _result("feature-collection.xml", "application/xml").model_copy(
        update={"body": body}
    )

    with pytest.raises(AccessFailure, match="exception report") as caught:
        ADAPTERS["ogc-wfs"].parse(
            _recipe(
                "ogc-wfs",
                ".//featureMember",
                "application/xml",
                id_path="/id/text",
            ),
            result,
        )

    assert "provider secret" not in str(caught.value)
