# Credential rotation

Use this for operator-owned database, object-store, identity, or webhook credentials. Upstream
provider credentials are outside this repository.

## Preconditions

- Identify the local secret reference and affected service without printing the secret.
- Take a recoverable backup and verify that `.env` remains ignored.

## Procedure

Create the replacement in the operator's secret store, update one service at a time, verify it,
then revoke the old value. Never place functional credentials in Compose, issues, logs, or commits.

## Verification

Run `uv run python scripts/runbook_check.py credential-rotation --dry-run`, the secret scan, and the
affected health check. Confirm the old credential is denied before considering rotation complete.
