# Local restore

Use this to test recovery of a self-hosted runtime without altering the running database.

## Preconditions

- Use an isolated target container and a newly created temporary directory.
- Ensure the source is the operator's own runtime and raw-object handling matches its retention rule.

## Procedure

Start with `sh scripts/restore-drill.sh --dry-run`. For an opted-in local Compose stack, use the
script's `--local-compose` mode to create a logical backup and restore it into a network-isolated
temporary database.

## Verification

Run `uv run python scripts/runbook_check.py restore --dry-run`. The drill must compare migration
hashes, row counts, raw references, and recovery timing, then remove the temporary container.
