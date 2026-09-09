from __future__ import annotations

import json
import subprocess
import sys
from collections import Counter
from pathlib import Path

from scripts.catalog import load_records, validate_records
from scripts.import_catalogue import import_rows

IMPORT_FIXTURES = Path(__file__).parent / "fixtures" / "import"


def test_official_row_preserves_identity_and_neutralizes_rights_analysis() -> None:
    rows = [
        {
            "ID": "HKAPI-001",
            "Domain": "Platforms & Discovery",
            "API / Feed / Dataset Family": "Catalogue API",
            "Provider": "Digital Policy Office",
            "Access Class": "Open REST/JSON",
            "Timeliness": "On request",
            "Update Cadence": "Metadata changes",
            "Protocol / Format": "HTTPS GET / JSON",
            "Authentication": "None",
            "Official Documentation / Catalogue": "https://data.gov.hk/",
            "Reuse / Rights": "verify dataset-specific terms",
            "Operational Status": "Active",
            "Coverage / What You Can Build": "Discover public catalogue metadata.",
            "Limitations / Implementation Notes": "Metadata only.",
            "Verified": "2026-08-27",
        }
    ]

    record = import_rows("official", rows)[0]

    assert record["id"] == "official:hkapi-001"
    assert record["sourceReference"] == "HKAPI-001"
    assert record["termsEvidence"]["state"] == "ambiguity-identified"
    assert "allowed" not in record["termsEvidence"]["note"]["en"].lower()
    assert record["translationStatus"] == "seeded"
    assert validate_records([{**record, "_path": "official.yml"}]) == []


def test_external_row_records_candidate_status_without_suitability_rating() -> None:
    rows = [
        {
            "Source ID": "EXT-001",
            "Priority": "P0",
            "Utility score": "5",
            "Coverage class": "HK-native",
            "Category": "Geocoding",
            "API": "Hong Kong GeoData Store",
            "Hong Kong-useful capability": "Hong Kong geospatial datasets and map layers.",
            "Auth in repository": "No",
            "HTTPS": "Yes",
            "CORS": "Unknown",
            "Open-source suitability": "High",
            "Commercial / terms risk": "Government terms and attribution apply.",
            "Recommended production role": "Primary source",
            "Provider documentation": "https://geodata.gov.hk/gs/",
            "Repository category": "https://example.invalid/geocoding",
        }
    ]

    record = import_rows("external", rows)[0]

    serialized = json.dumps(record).lower()
    assert record["verification"]["status"] == "candidate"
    assert record["termsEvidence"]["state"] == "restriction-identified"
    assert "utility score" not in serialized
    assert "open-source suitability" not in serialized
    assert "primary source" not in serialized


def test_external_row_uses_only_a_source_verified_https_override() -> None:
    verified_row = {
        "Source ID": "EXT-018",
        "Coverage class": "Global with HK coverage",
        "Category": "Geocoding",
        "API": "OpenStreetMap",
        "Hong Kong-useful capability": "Open map and geographic data.",
        "Auth in repository": "OAuth",
        "HTTPS": "No",
        "Commercial / terms risk": "ODbL attribution and share-alike apply.",
        "Provider documentation": "http://wiki.openstreetmap.org/wiki/API",
    }
    unknown_row = {**verified_row, "Source ID": "EXT-999"}

    verified = import_rows("external", [verified_row])[0]
    unknown = import_rows("external", [unknown_row])[0]

    assert verified["urls"]["documentation"] == "https://wiki.openstreetmap.org/wiki/API"
    assert verified["verification"]["evidenceUrl"] == "https://wiki.openstreetmap.org/wiki/API"
    assert unknown["urls"]["documentation"] == "http://wiki.openstreetmap.org/wiki/API"


def test_mcp_row_is_a_candidate_not_a_security_endorsement() -> None:
    rows = [
        {
            "MCP ID": "MCP-001",
            "Category": "Aggregators",
            "Server": "example/server",
            "GitHub URL": "https://github.com/example/server",
            "Direct Hong Kong relevance": "No",
            "Authority model": "Community implementation",
            "Priority score": "5.1",
            "Tier": "P2",
            "Project matches": "P01,P14",
            "Recommended role": "Reference gateway",
            "Build / reuse": "Evaluate/reuse",
            "Verification status": "README-level review; production verification pending",
            "Notes": "Review required.",
        }
    ]

    record = import_rows("mcp", rows)[0]

    assert record["verification"]["status"] == "candidate"
    assert record["termsEvidence"]["state"] == "not-reviewed"
    assert record["integrations"]["mcp"] == "candidate"
    assert "endor" not in json.dumps(record).lower()


def test_importer_runs_as_a_direct_cli(tmp_path: Path) -> None:
    result = subprocess.run(
        [
            sys.executable,
            "scripts/import_catalogue.py",
            "--official",
            str(IMPORT_FIXTURES / "official.csv"),
            "--external",
            str(IMPORT_FIXTURES / "external.csv"),
            "--mcp",
            str(IMPORT_FIXTURES / "mcp.csv"),
            "--output",
            str(tmp_path),
        ],
        check=False,
        capture_output=True,
        text=True,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == "official=1 external=1 mcp=1 total=3"
    assert len(load_records(tmp_path)) == 3


def test_committed_catalogue_has_complete_import() -> None:
    records = load_records(Path("catalog"))
    counts = Counter(item["type"] for item in records)

    assert counts == {"official": 265, "external": 145, "mcp": 111}
    assert len({item["id"] for item in records}) == 521
    assert len({(item["type"], item["sourceReference"]) for item in records}) == 521
    assert validate_records(records) == []


def test_catalogue_contains_no_project_legal_clearance_claims() -> None:
    forbidden = (
        "commercial use allowed",
        "safe to cache",
        "redistribution approved",
        "legally cleared",
    )
    for record in load_records(Path("catalog")):
        text = json.dumps(record, ensure_ascii=False).lower()
        assert all(phrase not in text for phrase in forbidden)
