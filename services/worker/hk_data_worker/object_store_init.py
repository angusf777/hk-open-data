from __future__ import annotations

import os
from typing import Any, Protocol

from boto3 import client as boto3_client  # type: ignore[import-untyped]
from botocore.client import Config  # type: ignore[import-untyped]
from botocore.exceptions import ClientError  # type: ignore[import-untyped]


class ObjectStoreAdminClient(Protocol):
    def head_bucket(self, **kwargs: Any) -> Any: ...

    def create_bucket(self, **kwargs: Any) -> Any: ...

    def put_bucket_versioning(self, **kwargs: Any) -> Any: ...

    def put_public_access_block(self, **kwargs: Any) -> Any: ...

    def get_object_lock_configuration(self, **kwargs: Any) -> dict[str, Any]: ...


def ensure_evidence_bucket(client: ObjectStoreAdminClient, bucket: str) -> None:
    try:
        client.head_bucket(Bucket=bucket)
    except ClientError as error:
        code = str(error.response.get("Error", {}).get("Code", ""))
        if code not in {"404", "NoSuchBucket", "NotFound"}:
            raise
        client.create_bucket(Bucket=bucket, ObjectLockEnabledForBucket=True)

    client.put_bucket_versioning(
        Bucket=bucket,
        VersioningConfiguration={"Status": "Enabled"},
    )
    client.put_public_access_block(
        Bucket=bucket,
        PublicAccessBlockConfiguration={
            "BlockPublicAcls": True,
            "IgnorePublicAcls": True,
            "BlockPublicPolicy": True,
            "RestrictPublicBuckets": True,
        },
    )
    lock = client.get_object_lock_configuration(Bucket=bucket)
    if lock.get("ObjectLockConfiguration", {}).get("ObjectLockEnabled") != "Enabled":
        raise RuntimeError(f"object lock is not enabled for evidence bucket {bucket!r}")


def required_environment(name: str) -> str:
    value = os.environ.get(name, "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    return value


def main() -> None:
    endpoint = required_environment("OBJECT_STORE_ENDPOINT")
    access_key = required_environment("OBJECT_STORE_ACCESS_KEY")
    secret_key = required_environment("OBJECT_STORE_SECRET_KEY")
    bucket = required_environment("OBJECT_STORE_BUCKET")
    client = boto3_client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name="us-east-1",
        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}),
    )
    ensure_evidence_bucket(client, bucket)


if __name__ == "__main__":
    main()
