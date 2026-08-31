from __future__ import annotations

import subprocess
from pathlib import Path

ROOT = Path(__file__).parents[2]
RUNBOOKS = (
    "provider-outage",
    "schema-drift",
    "stale-source",
    "credential-rotation",
    "raw-revocation",
    "restore",
    "correction",
    "mcp-revocation",
)


def test_each_operational_runbook_has_an_executable_safe_dry_run() -> None:
    for name in RUNBOOKS:
        document = ROOT / "docs/runbooks" / f"{name}.md"
        assert document.is_file(), name
        text = document.read_text(encoding="utf-8")
        assert "## Preconditions" in text
        assert "## Verification" in text
        assert f"scripts/runbook_check.py {name} --dry-run" in text
        result = subprocess.run(
            ["uv", "run", "python", "scripts/runbook_check.py", name, "--dry-run"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        assert result.returncode == 0, result.stderr
        assert '"mode":"dry-run"' in result.stdout
