from __future__ import annotations

from typing import Any

import pytest
from botocore.exceptions import ClientError
from hk_data_worker.object_store_init import ensure_evidence_bucket


class FakeS3Client:
    def __init__(self, *, exists: bool = False, lock_enabled: bool = True) -> None:
        self.exists = exists
        self.lock_enabled = lock_enabled
        self.calls: list[tuple[str, dict[str, Any]]] = []

    def head_bucket(self, **kwargs: Any) -> None:
        self.calls.append(("head_bucket", kwargs))
        if not self.exists:
            raise ClientError({"Error": {"Code": "NoSuchBucket"}}, "HeadBucket")

    def create_bucket(self, **kwargs: Any) -> None:
        self.calls.append(("create_bucket", kwargs))
        self.exists = True

    def put_bucket_versioning(self, **kwargs: Any) -> None:
        self.calls.append(("put_bucket_versioning", kwargs))

    def put_public_access_block(self, **kwargs: Any) -> None:
        self.calls.append(("put_public_access_block", kwargs))

    def get_object_lock_configuration(self, **kwargs: Any) -> dict[str, Any]:
        self.calls.append(("get_object_lock_configuration", kwargs))
        return {
            "ObjectLockConfiguration": {
                "ObjectLockEnabled": "Enabled" if self.lock_enabled else "Disabled"
            }
        }


def test_initializes_private_versioned_object_locked_evidence_bucket() -> None:
    client = FakeS3Client()

    ensure_evidence_bucket(client, "raw-snapshots")

    assert client.calls == [
        ("head_bucket", {"Bucket": "raw-snapshots"}),
        (
            "create_bucket",
            {"Bucket": "raw-snapshots", "ObjectLockEnabledForBucket": True},
        ),
        (
            "put_bucket_versioning",
            {"Bucket": "raw-snapshots", "VersioningConfiguration": {"Status": "Enabled"}},
        ),
        (
            "put_public_access_block",
            {
                "Bucket": "raw-snapshots",
                "PublicAccessBlockConfiguration": {
                    "BlockPublicAcls": True,
                    "IgnorePublicAcls": True,
                    "BlockPublicPolicy": True,
                    "RestrictPublicBuckets": True,
                },
            },
        ),
        ("get_object_lock_configuration", {"Bucket": "raw-snapshots"}),
    ]


def test_fails_closed_when_existing_bucket_lacks_object_lock() -> None:
    client = FakeS3Client(exists=True, lock_enabled=False)

    with pytest.raises(RuntimeError, match="object lock is not enabled"):
        ensure_evidence_bucket(client, "raw-snapshots")
