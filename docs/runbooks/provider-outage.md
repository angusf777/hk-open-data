# Provider outage

Use this when an explicitly enabled source becomes unreachable. A local observation is not proof
that the provider is globally unavailable.

## Preconditions

- Confirm the runtime is `observe` or `fabric`; the catalogue profile makes no provider requests.
- Preserve the observation ID, timestamp, error class, and source ID without copying response data.
- Do not increase request frequency while investigating.

## Procedure

Pause the affected connector or monitor, compare at least one independent observation, and record
the local scope of the incident. Avoid contacting or representing the provider unless you are
authorized to do so.

## Verification

Run `uv run python scripts/runbook_check.py provider-outage --dry-run`, then confirm the schedule is
paused and no new requests are emitted. Re-enable only after the operator reviews current source
terms and a healthy observation.
