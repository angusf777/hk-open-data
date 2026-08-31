# Public metadata correction

Use when a catalogue or published runtime record is inaccurate or misleading.

## Preconditions

- Preserve the source link, observation date, affected resource ID, and proposed factual change.
- Remove personal data and private correspondence from public evidence.

## Procedure

Follow the repository correction and takedown policy, patch the smallest authoritative YAML or
runtime record, regenerate deterministic artifacts, and state uncertainty rather than guessing.

## Verification

Run `uv run python scripts/runbook_check.py correction --dry-run`, catalogue validation, and the
public-boundary scan. Confirm generated files and visible resource copy match the correction.
