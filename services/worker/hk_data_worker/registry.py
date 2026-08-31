from __future__ import annotations

import csv
import json
from pathlib import Path

from pydantic import BaseModel

from .models import MonitorTarget, SourceGroup


def _split(value: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in value.split(";") if item.strip())


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError(f"{path} has no header")
        rows = []
        for number, row in enumerate(reader, start=2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"{path}:{number} has a malformed column count")
            rows.append({key: value.strip() for key, value in row.items() if key is not None})
        return rows


def _unique[ModelT: BaseModel](models: list[ModelT], field: str) -> list[ModelT]:
    values = [str(getattr(model, field)) for model in models]
    duplicate = next((value for value in values if values.count(value) > 1), None)
    if duplicate is not None:
        raise ValueError(f"duplicate {field}: {duplicate}")
    return models


def load_source_groups(path: Path) -> list[SourceGroup]:
    groups = [
        SourceGroup.model_validate(
            {
                **row,
                "source_ids": _split(row["source_ids"]),
                "protocols": _split(row["protocols"]),
                "first_connector_scope": _split(row["first_connector_scope"]),
                "activation_gate": _split(row["activation_gate"]),
            }
        )
        for row in _rows(path)
    ]
    return _unique(groups, "source_group_id")


def load_monitor_targets(path: Path) -> list[MonitorTarget]:
    targets: list[MonitorTarget] = []
    for row in _rows(path):
        body_text = row["request_body_json"]
        body = None if body_text == "" else json.loads(body_text)
        if body is not None and not isinstance(body, dict):
            raise ValueError("request_body_json must be an object")
        target = MonitorTarget.model_validate(
            {
                **row,
                "request_body_json": body,
                "cadence_seconds": int(row["cadence_seconds"]),
                "timeout_ms": int(row["timeout_ms"]),
                "required_checks": _split(row["required_checks"]),
            }
        )
        if target.method == "POST" and target.request_body_json is None:
            raise ValueError(f"{target.monitor_id} POST target requires request_body_json")
        if target.method == "GET" and target.request_body_json is not None:
            raise ValueError(f"{target.monitor_id} GET target cannot define request_body_json")
        targets.append(target)
    return _unique(targets, "monitor_id")
