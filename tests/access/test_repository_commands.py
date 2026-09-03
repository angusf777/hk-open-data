from __future__ import annotations

import json
import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path

from hk_data_worker.access.generation import recipe_sha256
from hk_data_worker.access.models import VerificationEvidence
from hk_data_worker.access.registry import load_recipes

from scripts.access import main

FIXTURES = Path(__file__).parent / "fixtures"


def _repository(tmp_path: Path) -> Path:
    recipe_root = tmp_path / "access" / "recipes" / "official"
    recipe_root.mkdir(parents=True)
    shutil.copy(FIXTURES / "valid" / "hkapi-001.yml", recipe_root)
    catalogue_root = tmp_path / "catalog" / "official"
    catalogue_root.mkdir(parents=True)
    (catalogue_root / "hkapi-001.yml").write_text(
        "sourceReference: HKAPI-001\npublicationStatus: published\n",
        encoding="utf-8",
    )
    return tmp_path


def test_repository_commands_validate_generate_and_detect_drift(
    tmp_path: Path, capsys: object
) -> None:
    root = _repository(tmp_path)
    provider_inventory = root / "access" / "generated" / "data-gov-resources.json"
    provider_inventory.parent.mkdir(parents=True)
    provider_inventory.write_text('{"preserve": true}\n', encoding="utf-8")

    assert main(["validate"], repository_root=root) == 0
    assert main(["generate"], repository_root=root) == 0
    assert provider_inventory.read_text(encoding="utf-8") == '{"preserve": true}\n'
    assert main(["check"], repository_root=root) == 0

    generated = root / "access" / "generated" / "recipes.json"
    generated.write_text("{}\n", encoding="utf-8")

    assert main(["check"], repository_root=root) == 1


def test_generate_writes_a_deterministic_public_status_index(tmp_path: Path) -> None:
    root = _repository(tmp_path)
    recipe = load_recipes(root / "access" / "recipes" / "official")[0]
    checked_at = datetime.now(UTC)
    evidence = VerificationEvidence(
        schema_version=1,
        source_reference=recipe.source_reference,
        recipe_version=recipe.recipe_version,
        recipe_sha256=recipe_sha256(recipe),
        checked_at=checked_at,
        valid_until=checked_at + timedelta(days=7),
        outcome="failure",
        error_code="SOURCE_UNAVAILABLE",
        final_host="data.gov.hk",
        http_status=None,
        elapsed_ms=0,
        media_type=None,
        response_bytes=0,
        response_sha256=None,
        schema_fingerprint=None,
        parsed_record_count=0,
        limitations=("No provider content was retained.",),
        tool_version="0.1.0",
    )
    evidence_root = root / "access" / "verification"
    evidence_root.mkdir(parents=True)
    (evidence_root / "hkapi-001.json").write_text(
        json.dumps(evidence.model_dump(mode="json", by_alias=True), default=str),
        encoding="utf-8",
    )

    assert main(["generate"], repository_root=root) == 0

    status = (root / "docs" / "access" / "source-status.md").read_text(
        encoding="utf-8"
    )
    assert "- Total official sources: 1" in status
    assert "- Live verification attempts recorded: 1" in status
    assert "- Successful live verification records: 0" in status
    assert "- Failed live verification records: 1" in status
    assert "package metadata compatibility" in status
    assert "provider-resources.md" in status
    assert "| HKAPI-001 | fixture-tested | ckan-action | failure |" in status

    assert main(["check"], repository_root=root) == 0
    (root / "docs" / "access" / "source-status.md").write_text(
        "stale\n", encoding="utf-8"
    )
    assert main(["check"], repository_root=root) == 1
