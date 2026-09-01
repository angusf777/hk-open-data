# MCP access revocation

Use when a local MCP client or gateway token must lose access to the self-hosted runtime.

## Preconditions

- Identify the client and token reference managed by your deployment without logging bearer material.
- Confirm the MCP server remains read-only; token revocation does not replace tool-surface review.

## Procedure

Revoke the identity-provider token or client, terminate active transport sessions, and rotate any
shared local secret. Do not change upstream provider accounts through this runbook.

## Verification

Run `uv run python scripts/runbook_check.py mcp-revocation --dry-run`, then verify the revoked client
is denied and an authorized local test client can still list exactly the expected read-only tools.
