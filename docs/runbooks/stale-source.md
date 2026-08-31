# Stale source

Use this when the last provider timestamp exceeds the source-specific freshness rule.

## Preconditions

- Distinguish provider publication time from local retrieval time.
- Check the schedule lease and last completed run before attributing the delay upstream.

## Procedure

Keep the last reviewed record labelled stale, inspect the scheduler and source publication notes,
and pause repeated probes if the provider documents maintenance. Never present freshness as a
guarantee of completeness.

## Verification

Run `uv run python scripts/runbook_check.py stale-source --dry-run`. Confirm that the public response
retains its observation time and stale label and that no retry loop exceeds the configured cadence.
