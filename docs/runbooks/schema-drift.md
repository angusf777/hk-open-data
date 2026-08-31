# Schema drift

Use this when a synthetic test or local observation differs from the reviewed baseline.

## Preconditions

- Identify the exact source, connector version, observation, and baseline version.
- Keep the raw body unavailable in `observe`; use its digest and derived shape only.

## Procedure

Quarantine normalization for the affected shape, classify additive versus breaking change, update
synthetic fixtures if appropriate, and review the connector in a pull request. Do not silently
coerce incompatible data.

## Verification

Run `uv run python scripts/runbook_check.py schema-drift --dry-run` and the connector, provenance,
and seeded-failure suites. Confirm the old fixture still fails in the intended way before enabling
the new connector version.
