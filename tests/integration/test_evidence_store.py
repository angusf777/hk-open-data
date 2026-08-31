from __future__ import annotations

from io import BytesIO
from pathlib import Path

import pytest
from hk_data_worker.hashing import sha256_hex
from hk_data_worker.storage import (
    DigestOnlyEvidenceStore,
    EvidenceBodyUnavailable,
    LocalEvidenceStore,
    S3EvidenceStore,
)


class FakeS3Client:
    def __init__(self) -> None:
        self.objects: dict[str, tuple[bytes, dict[str, str]]] = {}

    def put_object(self, **kwargs: object) -> object:
        key = str(kwargs["Key"])
        if key in self.objects:
            raise RuntimeError("precondition failed")
        body = kwargs["Body"]
        metadata = kwargs["Metadata"]
        assert isinstance(body, bytes)
        assert isinstance(metadata, dict)
        self.objects[key] = (body, {str(name): str(value) for name, value in metadata.items()})
        return {}

    def head_object(self, **kwargs: object) -> dict[str, object]:
        body, metadata = self.objects[str(kwargs["Key"])]
        return {"ContentLength": len(body), "Metadata": metadata}

    def get_object(self, **kwargs: object) -> dict[str, object]:
        body, _metadata = self.objects[str(kwargs["Key"])]
        return {"Body": BytesIO(body)}


def test_digest_store_retains_metadata_but_never_the_body() -> None:
    store = DigestOnlyEvidenceStore()
    payload = b'{"ok":true}'

    reference = store.put(payload, "application/json", "ignored")

    assert reference.object_uri == f"digest://sha256/{sha256_hex(payload)}"
    assert reference.size_bytes == len(payload)
    assert reference.retention_class == "metadata-only"
    with pytest.raises(EvidenceBodyUnavailable, match="not retained"):
        store.get(reference)


def test_content_addressed_put_is_idempotent_and_immutable(tmp_path: Path) -> None:
    store = LocalEvidenceStore(tmp_path)
    payload = b'{"source":"fixture"}'

    first = store.put(payload, "application/json", "rights-specific")
    second = store.put(payload, "application/json", "rights-specific")

    assert first == second
    assert first.sha256 == sha256_hex(payload)
    assert first.size_bytes == len(payload)
    assert first.object_uri.startswith("file://")
    assert store.get(first) == payload
    object_path = Path(first.object_uri.removeprefix("file://"))
    assert object_path.read_bytes() == payload
    assert len(list(tmp_path.rglob("*.blob"))) == 1


def test_same_hash_never_overwrites_different_existing_bytes(tmp_path: Path) -> None:
    store = LocalEvidenceStore(tmp_path)
    payload = b"original"
    object_ref = store.put(payload, "application/octet-stream", "short")
    object_path = Path(object_ref.object_uri.removeprefix("file://"))
    object_path.chmod(0o640)
    object_path.write_bytes(b"tampered")

    try:
        store.put(payload, "application/octet-stream", "short")
    except RuntimeError as error:
        assert "integrity" in str(error)
    else:
        raise AssertionError("tampered content-addressed object was accepted")


def test_s3_put_uses_create_only_content_address_and_verifies_retry() -> None:
    client = FakeS3Client()
    store = S3EvidenceStore(client=client, bucket="evidence")

    first = store.put(b"provider bytes", "application/json", "rights-specific")
    second = store.put(b"provider bytes", "application/json", "rights-specific")

    assert first == second
    assert store.get(first) == b"provider bytes"
    assert first.object_uri.startswith("s3://evidence/raw/")
    assert len(client.objects) == 1
