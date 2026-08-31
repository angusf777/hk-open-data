from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Literal, cast

OperatingProfile = Literal["catalogue", "observe", "fabric"]
EvidenceMode = Literal["none", "digest", "raw"]


@dataclass(frozen=True)
class RuntimeConfiguration:
    database_url: str
    source_groups_path: Path
    monitor_targets_path: Path
    ready_path: Path
    poll_seconds: float
    profile: OperatingProfile = "catalogue"
    provider_access: bool = False
    evidence_mode: EvidenceMode = "none"
    object_store_endpoint: str | None = None
    object_store_bucket: str | None = None
    object_store_access_key: str | None = None
    object_store_secret_key: str | None = None


def _boolean(values: Mapping[str, str], name: str) -> bool:
    value = values.get(name, "false")
    if value not in {"true", "false"}:
        raise ValueError(f"{name} must be exactly true or false")
    return value == "true"


def load_configuration(
    environment: Mapping[str, str] | None = None,
) -> RuntimeConfiguration:
    values: Mapping[str, str] = os.environ if environment is None else environment
    required = ["DATABASE_URL", "SOURCE_GROUPS_PATH", "MONITOR_TARGETS_PATH"]
    missing = [name for name in required if not values.get(name)]
    if missing:
        raise ValueError(f"missing required worker configuration: {', '.join(missing)}")

    profile_value = values.get("HKOD_PROFILE", "catalogue")
    if profile_value not in {"catalogue", "observe", "fabric"}:
        raise ValueError("HKOD_PROFILE must be exactly catalogue, observe, or fabric")
    profile = cast(OperatingProfile, profile_value)
    provider_opt_in = _boolean(values, "HKOD_ENABLE_PROVIDER_ACCESS")
    raw_opt_in = _boolean(values, "HKOD_ENABLE_RAW_EVIDENCE")

    if profile == "catalogue":
        if provider_opt_in or raw_opt_in:
            raise ValueError("catalogue profile rejects provider access and raw evidence")
        provider_access = False
        evidence_mode: EvidenceMode = "none"
    elif profile == "observe":
        if not provider_opt_in:
            raise ValueError("observe profile requires HKOD_ENABLE_PROVIDER_ACCESS=true")
        if raw_opt_in:
            raise ValueError("observe profile rejects HKOD_ENABLE_RAW_EVIDENCE=true")
        provider_access = True
        evidence_mode = "digest"
    else:
        if not provider_opt_in:
            raise ValueError("fabric profile requires HKOD_ENABLE_PROVIDER_ACCESS=true")
        if not raw_opt_in:
            raise ValueError("fabric profile requires HKOD_ENABLE_RAW_EVIDENCE=true")
        provider_access = True
        evidence_mode = "raw"

    poll_seconds = float(values.get("WORKER_POLL_SECONDS", "5"))
    if poll_seconds <= 0 or poll_seconds > 60:
        raise ValueError("WORKER_POLL_SECONDS must be greater than 0 and at most 60")

    object_names = [
        "OBJECT_STORE_ENDPOINT",
        "OBJECT_STORE_BUCKET",
        "OBJECT_STORE_ACCESS_KEY",
        "OBJECT_STORE_SECRET_KEY",
    ]
    if evidence_mode == "raw":
        object_missing = [name for name in object_names if not values.get(name)]
        if object_missing:
            raise ValueError(
                "fabric profile requires complete OBJECT_STORE configuration: "
                + ", ".join(object_missing)
            )

    return RuntimeConfiguration(
        database_url=values["DATABASE_URL"],
        source_groups_path=Path(values["SOURCE_GROUPS_PATH"]),
        monitor_targets_path=Path(values["MONITOR_TARGETS_PATH"]),
        ready_path=Path(values.get("WORKER_READY_PATH", "/tmp/worker-ready")),
        poll_seconds=poll_seconds,
        profile=profile,
        provider_access=provider_access,
        evidence_mode=evidence_mode,
        object_store_endpoint=values.get("OBJECT_STORE_ENDPOINT") or None,
        object_store_bucket=values.get("OBJECT_STORE_BUCKET") or None,
        object_store_access_key=values.get("OBJECT_STORE_ACCESS_KEY") or None,
        object_store_secret_key=values.get("OBJECT_STORE_SECRET_KEY") or None,
    )
