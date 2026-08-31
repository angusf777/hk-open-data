# P01/P14 First-Party MCP Tool Contract

**Contract version:** `2026-08-28.v1`  
**Runtime rule:** read-only; no third-party MCP dependency

The MCP server is an alternate read transport over the same authorized application services used by the REST API. It must not query upstream providers directly, bypass approval state, expose raw credentials or turn external content into instructions.

## Common response envelope

Every successful tool result contains:

```json
{
  "contract_version": "2026-08-28.v1",
  "data": {},
  "evidence": {
    "source_record_ids": [],
    "retrieved_at": "2026-08-28T00:00:00Z",
    "freshness_status": "fresh",
    "limitations": []
  },
  "next_cursor": null
}
```

Errors contain `code`, `message`, `retryable` and `correlation_id`. They never contain secrets, upstream authorization headers or raw stack traces.

## Tools

### `sources_list`

Lists sources visible to the caller.

- Inputs: `project`, `authority_class`, `freshness_status`, `approval_status`, `cursor`, `limit`
- Limit: 1–200, default 50
- Required scope: `sources:read`
- Output: source summaries and approval/use limitations

### `source_get`

Gets one source definition and its current health.

- Inputs: `source_id`
- Required scope: `sources:read`
- Output: source identity, provider, cadence, authority, freshness, last success, documentation and limitations

### `source_records_query`

Queries approved normalized source records.

- Inputs: `source_id`, `observed_from`, `observed_to`, `published_from`, `published_to`, `language`, `cursor`, `limit`
- Required scope: `records:read`
- Output: bounded source-record summaries with evidence
- Prohibited: arbitrary SQL, arbitrary URL fetch and unrestricted full-text export

### `source_record_get`

Gets one source record and its provenance chain.

- Inputs: `source_record_id`, `include_lineage` defaulting to `true`
- Required scope: `records:read`
- Output: normalized record, hashes, source metadata and parent lineage
- Raw object bodies are not returned through MCP.

### `events_query`

Queries canonical events.

- Inputs: `event_type`, `status`, `severity`, `observed_from`, `observed_to`, `affected_entity`, `cursor`, `limit`
- Required scope: `events:read`
- Output: events with evidence and explicit expiry

### `event_get`

Gets one canonical event.

- Inputs: `event_id`
- Required scope: `events:read`
- Output: event, affected entities/geometry, evidence, confidence and limitations

### `monitor_targets_list`

Lists public or caller-authorized monitor targets.

- Inputs: `provider`, `source_id`, `outcome`, `cursor`, `limit`
- Required scope: `status:read`; anonymous calls receive public fields only
- Output: target summaries, last check, outcome and public incident count

### `monitor_target_get`

Gets one target’s current status and bounded observation history.

- Inputs: `monitor_id`, `history_limit` from 1–100
- Required scope: `status:read`
- Output: target, observations, baseline version and incidents

### `incidents_list`

Lists incidents visible to the caller.

- Inputs: `status`, `severity`, `source_id`, `opened_from`, `opened_to`, `cursor`, `limit`
- Required scope: `status:read`
- Output: reviewed incident summaries; internal notes remain private

### `incident_get`

Gets one incident and evidence timeline.

- Inputs: `incident_id`
- Required scope: `status:read`
- Output: incident state, affected targets, reviewed evidence, updates and correction history

### `status_summary`

Returns aggregate status without accepting inputs that can change system state.

- Inputs: `project` and `provider` filters only
- Required scope: none for public view; `status:read` for private view
- Output: target counts by outcome, current public incidents and last-updated time

## Explicitly prohibited tools

The v0 server must not expose tools that:

- add, edit, approve or delete sources;
- change monitor rules or baselines;
- acknowledge, suppress or resolve incidents;
- create webhooks or rotate credentials;
- retrieve arbitrary URLs;
- execute SQL, shell commands or browser actions;
- return raw object bodies; or
- send external communications.

Any future write workflow requires a separate prepare/show/approve/commit contract and governance review.

## Contract verification

- Tool names and input schemas are fingerprinted at build time.
- A startup self-test compares the exposed tool list with the pinned contract.
- A mismatch prevents production readiness and raises a P14 incident.
- REST and MCP calls for the same authorized object must return the same object version and evidence IDs.
- Authorization, pagination, size and rate-limit tests apply equally to REST and MCP.
