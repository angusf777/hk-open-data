from __future__ import annotations

from hashlib import sha256


def sha256_hex(value: bytes) -> str:
    return sha256(value).hexdigest()
