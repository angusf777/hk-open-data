from __future__ import annotations

import os
from pathlib import Path
from typing import Protocol

from .hashing import sha256_hex
from .models import RawObjectRef


def _reference(
    *, body: bytes, media_type: str, retention_class: str, object_uri: str
) -> RawObjectRef:
    digest = sha256_hex(body)
    return RawObjectRef(
        raw_object_id=f"RAW-{digest}",
        object_uri=object_uri,
        sha256=digest,
        media_type=media_type,
        size_bytes=len(body),
        retention_class=retention_class,
    )


class EvidenceStore(Protocol):
    def put(self, body: bytes, media_type: str, retention_class: str) -> RawObjectRef: ...

    def get(self, reference: RawObjectRef) -> bytes: ...


class EvidenceBodyUnavailable(RuntimeError):
    """The evidence reference intentionally has no retrievable body."""


class DigestOnlyEvidenceStore:
    """Create content digests without retaining provider response bytes."""

    def put(self, body: bytes, media_type: str, retention_class: str) -> RawObjectRef:
        del retention_class
        digest = sha256_hex(body)
        return _reference(
            body=body,
            media_type=media_type,
            retention_class="metadata-only",
            object_uri=f"digest://sha256/{digest}",
        )

    def get(self, reference: RawObjectRef) -> bytes:
        raise EvidenceBodyUnavailable(f"body is not retained for {reference.raw_object_id}")


class LocalEvidenceStore:
    def __init__(self, root: Path) -> None:
        self._root = root.resolve()

    def put(self, body: bytes, media_type: str, retention_class: str) -> RawObjectRef:
        digest = sha256_hex(body)
        path = self._root / digest[:2] / f"{digest}.blob"
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            descriptor = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o440)
        except FileExistsError:
            if path.read_bytes() != body:
                raise RuntimeError("content-addressed object integrity check failed") from None
        else:
            with os.fdopen(descriptor, "wb") as handle:
                handle.write(body)
                handle.flush()
                os.fsync(handle.fileno())
        return _reference(
            body=body,
            media_type=media_type,
            retention_class=retention_class,
            object_uri=path.as_uri(),
        )

    def get(self, reference: RawObjectRef) -> bytes:
        if not reference.object_uri.startswith("file://"):
            raise ValueError("local evidence reference must use file://")
        path = Path(reference.object_uri.removeprefix("file://")).resolve()
        if not path.is_relative_to(self._root):
            raise ValueError("local evidence reference escapes the configured root")
        body = path.read_bytes()
        if sha256_hex(body) != reference.sha256 or len(body) != reference.size_bytes:
            raise RuntimeError("content-addressed object integrity check failed")
        return body


class S3Client(Protocol):
    def put_object(self, **kwargs: object) -> object: ...

    def head_object(self, **kwargs: object) -> dict[str, object]: ...

    def get_object(self, **kwargs: object) -> dict[str, object]: ...


class S3EvidenceStore:
    def __init__(self, *, client: S3Client, bucket: str, prefix: str = "raw") -> None:
        self._client = client
        self._bucket = bucket
        self._prefix = prefix.strip("/")

    def put(self, body: bytes, media_type: str, retention_class: str) -> RawObjectRef:
        digest = sha256_hex(body)
        key = f"{self._prefix}/{digest[:2]}/{digest}.blob"
        try:
            self._client.put_object(
                Bucket=self._bucket,
                Key=key,
                Body=body,
                ContentType=media_type,
                Metadata={
                    "sha256": digest,
                    "retention-class": retention_class,
                },
                IfNoneMatch="*",
            )
        except Exception as error:
            metadata = self._client.head_object(Bucket=self._bucket, Key=key)
            object_metadata = metadata.get("Metadata")
            if (
                metadata.get("ContentLength") != len(body)
                or not isinstance(object_metadata, dict)
                or object_metadata.get("sha256") != digest
            ):
                raise RuntimeError("content-addressed object integrity check failed") from error
        return _reference(
            body=body,
            media_type=media_type,
            retention_class=retention_class,
            object_uri=f"s3://{self._bucket}/{key}",
        )

    def get(self, reference: RawObjectRef) -> bytes:
        prefix = f"s3://{self._bucket}/"
        if not reference.object_uri.startswith(prefix):
            raise ValueError("S3 evidence reference belongs to a different bucket")
        result = self._client.get_object(
            Bucket=self._bucket,
            Key=reference.object_uri.removeprefix(prefix),
        )
        stream = result.get("Body")
        if not hasattr(stream, "read"):
            raise RuntimeError("S3 evidence response omitted a readable body")
        body = stream.read(reference.size_bytes + 1)
        if not isinstance(body, bytes):
            raise RuntimeError("S3 evidence body is not bytes")
        if len(body) != reference.size_bytes or sha256_hex(body) != reference.sha256:
            raise RuntimeError("content-addressed object integrity check failed")
        return body
