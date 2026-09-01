import re
from pathlib import Path

ROOT = Path(__file__).parents[2]


def test_mcp_surface_is_exactly_read_only() -> None:
    server = (ROOT / "services/mcp/src/server.ts").read_text(encoding="utf-8")
    block = re.search(r"NORMATIVE_TOOL_NAMES = \[(.*?)\] as const", server, re.DOTALL)
    assert block is not None
    names = re.findall(r'"([a-z_]+)"', block.group(1))
    assert len(names) == 13
    assert len(names) == len(set(names))
    assert all(not re.search(r"create|update|delete|approve|resolve|write", name) for name in names)
    assert "readOnlyHint: true" in server
    assert "destructiveHint: false" in server
