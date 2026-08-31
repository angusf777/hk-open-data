# Raw-evidence revocation

Use when a source's raw-retention approval no longer applies. This is relevant only to `fabric`.

## Preconditions

- Record the source ID, applicable approval, retention rule, and immutable object references.
- Do not delete evidence subject to an operator's legal hold or mandatory retention rule.

## Procedure

Disable the connector first, prevent new raw writes, identify derived records through lineage, and
apply the operator's reviewed retention or deletion decision. A catalogue evidence label alone is
not an authorization decision.

## Verification

Run `uv run python scripts/runbook_check.py raw-revocation --dry-run`. Confirm the schedule is off,
new objects are not written, and the resulting object and record states have an audit entry.
