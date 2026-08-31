from __future__ import annotations

import csv
import io
import json
import re
import xml.etree.ElementTree as element_tree
from datetime import datetime

from ..models import CheckResult, MonitorTarget
from .baseline import MonitorBaseline, schema_shape


def values_at(document: object, pointer: str | None) -> list[object]:
    if pointer is None:
        return []
    if pointer == "/":
        return [document]
    values = [document]
    for encoded in pointer.removeprefix("/").split("/"):
        part = encoded.replace("~1", "/").replace("~0", "~")
        next_values: list[object] = []
        for value in values:
            if part == "*" and isinstance(value, list):
                next_values.extend(value)
            elif isinstance(value, dict) and part in value:
                next_values.append(value[part])
        values = next_values
    return values


def parse_payload(target: MonitorTarget, body: bytes) -> tuple[object | None, CheckResult]:
    checks = set(target.required_checks)
    try:
        if "json" in checks or "geojson" in checks:
            return json.loads(body), CheckResult(
                check="contract", outcome="pass", code="PAYLOAD_VALID"
            )
        if "xml" in checks:
            return element_tree.fromstring(body), CheckResult(
                check="contract", outcome="pass", code="PAYLOAD_VALID"
            )
        if "csv" in checks:
            rows = list(csv.reader(io.StringIO(body.decode("utf-8", errors="strict"))))
            if not rows or any(len(row) != len(rows[0]) for row in rows):
                raise ValueError("inconsistent CSV width")
            return rows, CheckResult(check="contract", outcome="pass", code="PAYLOAD_VALID")
    except (UnicodeDecodeError, json.JSONDecodeError, element_tree.ParseError, ValueError):
        return None, CheckResult(check="contract", outcome="fail", code="PAYLOAD_INVALID")
    return body, CheckResult(check="contract", outcome="pass", code="PAYLOAD_VALID")


def schema_checks(document: object, baseline: MonitorBaseline) -> list[CheckResult]:
    current = schema_shape(document)
    for pointer in baseline.required_pointers:
        if not values_at(document, pointer):
            return [
                CheckResult(
                    check="schema", outcome="fail", code="REQUIRED_FIELD_REMOVED", message=pointer
                )
            ]
    changed = [
        pointer
        for pointer, expected_type in baseline.schema_shape.items()
        if pointer in current and current[pointer] != expected_type
    ]
    if changed:
        return [
            CheckResult(
                check="schema",
                outcome="fail",
                code="FIELD_TYPE_CHANGED",
                message=changed[0],
            )
        ]
    added = sorted(set(current) - set(baseline.schema_shape))
    if added:
        return [
            CheckResult(check="schema", outcome="pass", code="SCHEMA_ADDITIVE", message=added[0])
        ]
    return [CheckResult(check="schema", outcome="pass", code="SCHEMA_COMPATIBLE")]


def semantic_checks(document: object, baseline: MonitorBaseline) -> list[CheckResult]:
    results: list[CheckResult] = []
    identifiers = values_at(document, baseline.identifier_pointer)
    if baseline.identifier_pattern is not None and any(
        not isinstance(value, str) or re.fullmatch(baseline.identifier_pattern, value) is None
        for value in identifiers
    ):
        results.append(CheckResult(check="semantic", outcome="fail", code="IDENTIFIER_INVALID"))
    if len(identifiers) != len({json.dumps(value, sort_keys=True) for value in identifiers}):
        results.append(CheckResult(check="semantic", outcome="fail", code="DUPLICATE_RECORD"))
    primary = values_at(document, baseline.bilingual_primary_pointer)
    peer = values_at(document, baseline.bilingual_peer_pointer)
    if primary and set(map(str, primary)) != set(map(str, peer)):
        results.append(
            CheckResult(check="bilingual", outcome="fail", code="BILINGUAL_IDENTIFIER_MISMATCH")
        )
    current_cursor = values_at(document, baseline.cursor_current_pointer)
    next_cursor = values_at(document, baseline.cursor_next_pointer)
    if current_cursor and next_cursor and current_cursor[0] == next_cursor[0]:
        results.append(CheckResult(check="semantic", outcome="fail", code="CHECKPOINT_LOOP"))
    event_items = values_at(document, baseline.event_list_pointer)
    if len(event_items) == 1 and isinstance(event_items[0], list) and not event_items[0]:
        results.append(CheckResult(check="semantic", outcome="pass", code="VALID_EMPTY_EVENT"))
    return results or [CheckResult(check="semantic", outcome="pass", code="SEMANTIC_VALID")]


def _position(value: object) -> bool:
    return (
        isinstance(value, list)
        and len(value) >= 2
        and isinstance(value[0], int | float)
        and not isinstance(value[0], bool)
        and isinstance(value[1], int | float)
        and not isinstance(value[1], bool)
        and -180 <= value[0] <= 180
        and -90 <= value[1] <= 90
    )


def _coordinates(value: object, depth: int) -> bool:
    if depth == 0:
        return _position(value)
    return (
        isinstance(value, list)
        and bool(value)
        and all(_coordinates(item, depth - 1) for item in value)
    )


def _valid_geometry(geometry: object) -> bool:
    if not isinstance(geometry, dict):
        return False
    geometry_type = geometry.get("type")
    coordinates = geometry.get("coordinates")
    depths = {
        "Point": 0,
        "MultiPoint": 1,
        "LineString": 1,
        "MultiLineString": 2,
        "Polygon": 2,
        "MultiPolygon": 3,
    }
    if geometry_type in depths:
        return _coordinates(coordinates, depths[str(geometry_type)])
    if geometry_type == "GeometryCollection":
        children = geometry.get("geometries")
        return (
            isinstance(children, list)
            and bool(children)
            and all(_valid_geometry(child) for child in children)
        )
    if "x" in geometry or "y" in geometry:
        return _position([geometry.get("x"), geometry.get("y")])
    for key, depth in (("points", 1), ("paths", 2), ("rings", 2)):
        if key in geometry:
            return _coordinates(geometry[key], depth)
    return False


def geometry_checks(document: object, baseline: MonitorBaseline) -> list[CheckResult]:
    geometries = values_at(document, baseline.geometry_pointer)
    crs = [
        *values_at(document, "/crs/name"),
        *values_at(document, "/crs/properties/name"),
    ]
    for geometry in geometries:
        if isinstance(geometry, dict):
            crs.extend(values_at(geometry, "/spatialReference/wkid"))
    invalid_crs = any(str(value) not in {"4326", "EPSG:4326", "CRS84"} for value in crs)
    if invalid_crs or any(not _valid_geometry(geometry) for geometry in geometries):
        return [CheckResult(check="geometry", outcome="fail", code="GEOMETRY_INVALID")]
    return [CheckResult(check="geometry", outcome="pass", code="GEOMETRY_VALID")]


def freshness_check(
    document: object, baseline: MonitorBaseline, clock: datetime
) -> tuple[CheckResult, datetime | None, int | None]:
    timestamps = values_at(document, baseline.provider_timestamp_pointer)
    if not timestamps or not isinstance(timestamps[0], str):
        return (
            CheckResult(check="freshness", outcome="unknown", code="PROVIDER_TIMESTAMP_MISSING"),
            None,
            None,
        )
    try:
        provider_time = datetime.fromisoformat(timestamps[0].replace("Z", "+00:00"))
    except ValueError:
        return (
            CheckResult(check="freshness", outcome="unknown", code="PROVIDER_TIMESTAMP_INVALID"),
            None,
            None,
        )
    if provider_time.tzinfo is None:
        return (
            CheckResult(check="freshness", outcome="unknown", code="PROVIDER_TIMEZONE_MISSING"),
            None,
            None,
        )
    age = max(0, int((clock - provider_time).total_seconds()))
    if baseline.max_age_seconds is not None and age > baseline.max_age_seconds:
        return (
            CheckResult(check="freshness", outcome="fail", code="FRESHNESS_EXCEEDED"),
            provider_time,
            age,
        )
    return (
        CheckResult(check="freshness", outcome="pass", code="FRESHNESS_WITHIN_THRESHOLD"),
        provider_time,
        age,
    )
