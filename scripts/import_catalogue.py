from __future__ import annotations

import argparse
import csv
import re
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import TYPE_CHECKING, Any

import yaml

if TYPE_CHECKING:
    from scripts.catalog import validate_records
elif __package__:
    from scripts.catalog import validate_records
else:
    from catalog import validate_records

IMPORT_DATE = "2026-08-31"
VERIFIED_HTTPS_OVERRIDES = {
    ("EXT-018", "http://wiki.openstreetmap.org/wiki/API"): (
        "https://wiki.openstreetmap.org/wiki/API"
    ),
    ("EXT-069", "http://www.aishub.net/api"): "https://www.aishub.net/api",
    ("EXT-095", "http://api.opencorporates.com/documentation/API-Reference"): (
        "https://api.opencorporates.com/documentation/API-Reference"
    ),
    ("EXT-105", "http://open-platform.theguardian.com/"): (
        "https://open-platform.theguardian.com/"
    ),
}


def _value(row: dict[str, str], key: str) -> str:
    return (row.get(key) or "").strip()


def _slug(value: str) -> str:
    words = re.findall(r"[a-z0-9]+", value.lower().replace("&", " and "))
    return "-".join(word for word in words if word != "and") or "other"


def _authentication(value: str) -> str:
    lowered = value.lower().replace(" ", "")
    if lowered in {"", "none", "no"}:
        return "none"
    if "oauth" in lowered:
        return "oauth2"
    if "apikey" in lowered or "api-key" in lowered:
        return "api-key"
    if any(word in lowered for word in ("onboarding", "consent", "client")):
        return "registration"
    return "unknown"


def _access(authentication: str, access_class: str = "") -> str:
    lowered = access_class.lower()
    if "download" in lowered or "file" in lowered:
        return "download"
    if authentication == "none":
        return "open-endpoint"
    if authentication == "registration":
        return "registration-required"
    if authentication in {"api-key", "oauth2", "session"}:
        return "credential-required"
    return "unknown"


def _protocols_and_formats(value: str) -> tuple[list[str], list[str]]:
    lowered = value.lower()
    protocols: list[str] = []
    formats: list[str] = []
    protocol_markers = {
        "https": "https",
        "rest": "rest",
        "graphql": "graphql",
        "rss": "rss",
        "ogc": "ogc",
        "wfs": "wfs",
        "wms": "wms",
        "arcgis": "arcgis",
        "odata": "odata",
        "websocket": "websocket",
        "xml": "xml",
        "file": "file",
    }
    format_markers = {
        "json": "json",
        "geojson": "geojson",
        "xml": "xml",
        "csv": "csv",
        "rss": "rss",
        "pdf": "pdf",
        "xlsx": "xlsx",
        "excel": "xlsx",
        "html": "html",
    }
    for marker, normalized in protocol_markers.items():
        if marker in lowered and normalized not in protocols:
            protocols.append(normalized)
    for marker, normalized in format_markers.items():
        if marker in lowered and normalized not in formats:
            formats.append(normalized)
    return protocols or ["https"], formats or ["other"]


def evidence_state(text: str) -> str:
    lowered = text.lower()
    if any(
        word in lowered
        for word in (
            "restrict",
            "prohibit",
            "attribution",
            "must ",
            "required",
            "do not",
            "cannot",
            "only",
        )
    ):
        return "restriction-identified"
    if text.strip():
        return "ambiguity-identified"
    return "not-reviewed"


def _terms_evidence(source_text: str, checked_at: str) -> dict[str, Any]:
    state = evidence_state(source_text)
    notes = {
        "not-reviewed": (
            "No current project review of upstream terms is recorded.",
            "本項目尚未記錄對上游條款的當前審查。",
        ),
        "ambiguity-identified": (
            "Available source notes indicate that current provider or dataset-specific terms "
            "require review.",
            "現有來源註記顯示，使用前須審查現行供應者或個別數據集條款。",
        ),
        "restriction-identified": (
            "Available source notes identify an upstream condition or restriction; consult the "
            "provider's current terms.",
            "現有來源註記識別了上游條件或限制；請查閱供應者的現行條款。",
        ),
    }
    note_en, note_zh = notes[state]
    restriction = (
        [
            {
                "en": (
                    "An upstream condition or restriction was identified; its current source "
                    "wording controls."
                ),
                "zh-Hant": "已識別上游條件或限制；應以上游來源的現行文字為準。",
            }
        ]
        if state == "restriction-identified"
        else []
    )
    attribution = (
        {
            "en": (
                "Source notes indicate an attribution condition; verify the provider's current "
                "wording."
            ),
            "zh-Hant": "來源註記顯示有署名條件；請核實供應者的現行文字。",
        }
        if "attribution" in source_text.lower()
        else None
    )
    return {
        "state": state,
        "checkedAt": checked_at,
        "note": {"en": note_en, "zh-Hant": note_zh},
        "attribution": attribution,
        "restrictions": restriction,
    }


def _base_record(
    *,
    kind: str,
    source_reference: str,
    title: str,
    provider: str,
    provider_type: str,
    summary: str,
    summary_zh: str,
    category: str,
    protocols: list[str],
    formats: list[str],
    authentication: str,
    access: str,
    url: str,
    checked_at: str,
    verification_status: str,
    terms_source: str,
    mcp_state: str = "none",
    tags: list[str] | None = None,
) -> dict[str, Any]:
    return {
        "schemaVersion": 1,
        "id": f"{kind}:{source_reference.lower()}",
        "sourceReference": source_reference,
        "type": kind,
        "publicationStatus": "published",
        "name": {"en": title, "zh-Hant": title},
        "summary": {"en": summary, "zh-Hant": summary_zh},
        "translationStatus": "seeded",
        "provider": {
            "name": {"en": provider, "zh-Hant": provider},
            "type": provider_type,
        },
        "categories": [_slug(category)],
        **({"tags": sorted(set(tags))} if tags else {}),
        "protocols": protocols,
        "formats": formats,
        "authentication": authentication,
        "access": access,
        "urls": {"landing": url, "documentation": url, "terms": None},
        "languages": ["en"],
        "verification": {
            "status": verification_status,
            "checkedAt": checked_at,
            "evidenceUrl": url,
        },
        "termsEvidence": _terms_evidence(terms_source, checked_at),
        "integrations": {"connector": "none", "sdk": "none", "mcp": mcp_state},
    }


def _map_official(row: dict[str, str]) -> dict[str, Any]:
    source_reference = _value(row, "ID")
    title = _value(row, "API / Feed / Dataset Family")
    provider = _value(row, "Provider")
    checked_at = _value(row, "Verified") or IMPORT_DATE
    protocols, formats = _protocols_and_formats(_value(row, "Protocol / Format"))
    authentication = _authentication(_value(row, "Authentication"))
    record = _base_record(
        kind="official",
        source_reference=source_reference,
        title=title,
        provider=provider,
        provider_type="public-authority",
        summary=_value(row, "Coverage / What You Can Build"),
        summary_zh=f"由 {provider} 提供的「{title}」資源。請參閱官方文件及最新上游條款。",
        category=_value(row, "Domain"),
        protocols=protocols,
        formats=formats,
        authentication=authentication,
        access=_access(authentication, _value(row, "Access Class")),
        url=_value(row, "Official Documentation / Catalogue"),
        checked_at=checked_at,
        verification_status="metadata-reviewed",
        terms_source=_value(row, "Reuse / Rights"),
        tags=[_value(row, "Subdomain")] if _value(row, "Subdomain") else None,
    )
    record["availability"] = f"Source index status: {_value(row, 'Operational Status')}"
    record["updateCadence"] = _value(row, "Update Cadence") or None
    if any(
        token in " ".join(str(value) for value in row.values()).lower()
        for token in ("bilingual", "traditional chinese", "chinese")
    ):
        record["languages"] = ["en", "zh-Hant"]
    return record


def _map_external(row: dict[str, str]) -> dict[str, Any]:
    source_reference = _value(row, "Source ID")
    title = _value(row, "API")
    authentication = _authentication(_value(row, "Auth in repository"))
    https = _value(row, "HTTPS").lower() == "yes"
    source_url = _value(row, "Provider documentation")
    url = VERIFIED_HTTPS_OVERRIDES.get((source_reference, source_url), source_url)
    return _base_record(
        kind="external",
        source_reference=source_reference,
        title=title,
        provider=title,
        provider_type="third-party",
        summary=_value(row, "Hong Kong-useful capability"),
        summary_zh=f"與香港用途相關的第三方「{title}」資源。使用前請核實供應者文件、保安及現行條款。",
        category=_value(row, "Category"),
        protocols=["https"] if https else ["other"],
        formats=["other"],
        authentication=authentication,
        access=_access(authentication),
        url=url,
        checked_at=IMPORT_DATE,
        verification_status="candidate",
        terms_source=_value(row, "Commercial / terms risk"),
        tags=[_value(row, "Coverage class")] if _value(row, "Coverage class") else None,
    )


def _map_mcp(row: dict[str, str]) -> dict[str, Any]:
    source_reference = _value(row, "MCP ID")
    title = _value(row, "Server")
    matches = [item.strip() for item in _value(row, "Project matches").split(",") if item.strip()]
    return _base_record(
        kind="mcp",
        source_reference=source_reference,
        title=title,
        provider=title,
        provider_type="community-project",
        summary=(
            "Community MCP candidate for Hong Kong data-tooling evaluation. "
            "Review its repository, licence, maintenance and security before use."
        ),
        summary_zh=(
            f"供香港數據工具評估的社群 MCP 候選項目「{title}」。"
            "使用前請審查其程式庫、授權、維護狀況及保安。"
        ),
        category=_value(row, "Category"),
        protocols=["mcp"],
        formats=["mcp"],
        authentication="not-applicable",
        access="repository",
        url=_value(row, "GitHub URL"),
        checked_at=IMPORT_DATE,
        verification_status="candidate",
        terms_source="",
        mcp_state="candidate",
        tags=matches or None,
    )


def import_rows(kind: str, rows: Iterable[dict[str, str]]) -> list[dict[str, Any]]:
    mappers = {"official": _map_official, "external": _map_external, "mcp": _map_mcp}
    if kind not in mappers:
        raise ValueError(f"unknown catalogue type: {kind}")
    records = [mappers[kind](row) for row in rows]
    return sorted(records, key=lambda item: str(item["id"]))


def _read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames is None:
            raise ValueError(f"{path} has no header")
        rows = []
        for number, row in enumerate(reader, start=2):
            if None in row or any(value is None for value in row.values()):
                raise ValueError(f"{path}:{number} has a malformed column count")
            rows.append({str(key): str(value).strip() for key, value in row.items()})
        return rows


def _write_records(records: list[dict[str, Any]], output: Path) -> None:
    grouped: dict[str, list[dict[str, Any]]] = {
        kind: [] for kind in ("official", "external", "mcp")
    }
    for record in records:
        grouped[str(record["type"])].append(record)
    for kind, matching in grouped.items():
        directory = output / kind
        directory.mkdir(parents=True, exist_ok=True)
        expected = {f"{record['id'].split(':', 1)[1]}.yml" for record in matching}
        extras = sorted(path.name for path in directory.glob("*.yml") if path.name not in expected)
        if extras:
            raise ValueError(f"refusing to remove unexpected {kind} records: {', '.join(extras)}")
        for record in matching:
            path = directory / f"{record['id'].split(':', 1)[1]}.yml"
            text = yaml.safe_dump(
                record,
                allow_unicode=True,
                sort_keys=False,
                width=1000,
            )
            path.write_text(text, encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Import source indexes as public metadata")
    parser.add_argument("--official", type=Path, required=True)
    parser.add_argument("--external", type=Path, required=True)
    parser.add_argument("--mcp", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args(argv)

    records = [
        *import_rows("official", _read_rows(args.official)),
        *import_rows("external", _read_rows(args.external)),
        *import_rows("mcp", _read_rows(args.mcp)),
    ]
    errors = validate_records(
        [{"_path": f"generated:{record['id']}", **record} for record in records]
    )
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    _write_records(records, args.output)
    counts = {
        kind: sum(record["type"] == kind for record in records)
        for kind in ("official", "external", "mcp")
    }
    print(
        f"official={counts['official']} external={counts['external']} "
        f"mcp={counts['mcp']} total={len(records)}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
