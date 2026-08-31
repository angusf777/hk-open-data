from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).parents[2]
FIXTURES = ROOT / "tests" / "fixtures" / "connectors"


def test_connector_fixtures_are_exhaustively_declared_synthetic_inputs() -> None:
    manifest = json.loads((FIXTURES / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["schemaVersion"] == 1
    assert manifest["origin"] == "synthetic-authored"
    assert manifest["containsUpstreamPayloads"] is False
    assert "not evidence of provider permission" in manifest["disclaimer"].lower()

    declared = manifest["files"]
    actual = {
        path.relative_to(FIXTURES).as_posix()
        for path in FIXTURES.glob("p01-sg-*/*.json")
    }
    assert set(declared) == actual
    for relative_path, expected_hash in declared.items():
        content = (FIXTURES / relative_path).read_bytes()
        assert hashlib.sha256(content).hexdigest() == expected_hash

