import subprocess
from pathlib import Path

ROOT = Path(__file__).parents[2]


def test_webhook_endpoint_security_vectors_execute() -> None:
    result = subprocess.run(
        ["pnpm", "exec", "vitest", "run", "src/webhooks/endpoint.test.ts"],
        cwd=ROOT / "services/api",
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "8 passed" in result.stdout
