from __future__ import annotations

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).parents[2]


def run_inventory(tmp_path: Path, **changes: object) -> subprocess.CompletedProcess[str]:
    value = {
        "isolated": True,
        "schema_migrations_match": True,
        "row_counts_match": True,
        "raw_hashes_match": True,
        "rpo_minutes": 12,
        "rto_minutes": 90,
        **changes,
    }
    path = tmp_path / "restore-inventory.json"
    path.write_text(json.dumps(value), encoding="utf-8")
    return subprocess.run(
        ["sh", "scripts/restore-drill.sh", "--verify", str(path)],
        cwd=ROOT,
        capture_output=True,
        text=True,
        check=False,
    )


def test_restore_verification_requires_hash_count_rpo_and_rto_evidence(tmp_path: Path) -> None:
    assert run_inventory(tmp_path).returncode == 0
    assert run_inventory(tmp_path, raw_hashes_match=False).returncode == 2
    assert run_inventory(tmp_path, rpo_minutes=16).returncode == 2
    assert run_inventory(tmp_path, rto_minutes=241).returncode == 2
