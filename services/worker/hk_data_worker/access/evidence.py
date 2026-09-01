from __future__ import annotations

import csv
import io
import json
import os
import tempfile
import xml.etree.ElementTree as ET
from hashlib import sha256
from pathlib import Path

from .models import VerificationEvidence


def _json_shape(value: object, path: str, output: set[str]) -> None:
    if isinstance(value, dict):
        output.add(f"{path}:object")
        for key, child in value.items():
            _json_shape(child, f"{path}/{key}", output)
    elif isinstance(value, list):
        output.add(f"{path}:array")
        for child in value:
            _json_shape(child, f"{path}/*", output)
    elif value is None:
        output.add(f"{path}:null")
    elif isinstance(value, bool):
        output.add(f"{path}:boolean")
    elif isinstance(value, int | float):
        output.add(f"{path}:number")
    else:
        output.add(f"{path}:string")


def _xml_shape(body: bytes) -> set[str]:
    lowered = body.lower()
    if b"<!doctype" in lowered or b"<!entity" in lowered:
        raise ValueError("XML declarations are forbidden")
    root = ET.fromstring(body)
    output: set[str] = set()

    def walk(element: ET.Element, path: str) -> None:
        tag = element.tag.rpartition("}")[2] if "}" in element.tag else element.tag
        current = f"{path}/{tag}"
        output.add(f"{current}:element")
        for name in element.attrib:
            output.add(f"{current}/@{name}:string")
        if (element.text or "").strip():
            output.add(f"{current}/text():string")
        for child in element:
            walk(child, current)

    walk(root, "")
    return output


def schema_fingerprint(body: bytes, media_type: str | None) -> str:
    normalized = (media_type or "application/octet-stream").partition(";")[0].lower()
    shape: set[str]
    if normalized == "application/json" or normalized.endswith("+json"):
        document = json.loads(body)
        shape = set()
        _json_shape(document, "", shape)
    elif normalized in {
        "application/xml",
        "text/xml",
        "application/rss+xml",
        "application/atom+xml",
    } or normalized.endswith("+xml"):
        shape = _xml_shape(body)
    elif normalized in {"text/csv", "application/csv"}:
        reader = csv.reader(io.StringIO(body.decode("utf-8-sig")))
        headers = next(reader, [])
        shape = {f"/{index}:{name}" for index, name in enumerate(headers)}
    else:
        shape = {f"media:{normalized}", f"size:{len(body)}"}
    return sha256("\n".join(sorted(shape)).encode()).hexdigest()


def write_evidence_atomic(path: Path, evidence: VerificationEvidence) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    data = (
        json.dumps(
            evidence.model_dump(mode="json", by_alias=True),
            ensure_ascii=False,
            indent=2,
            sort_keys=True,
        )
        + "\n"
    ).encode()
    VerificationEvidence.model_validate_json(data)
    descriptor, temporary_name = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    temporary = Path(temporary_name)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        temporary.replace(path)
        directory_descriptor = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory_descriptor)
        finally:
            os.close(directory_descriptor)
    except BaseException:
        try:
            os.close(descriptor)
        except OSError:
            pass
        temporary.unlink(missing_ok=True)
        raise
