# Optional self-hosted runtime

The catalogue is available without Docker. The P01/P14 runtime is optional and is intended for
operators who want local API-quality observations or normalized read access. It is not a hosted
service, data resale product, or grant of rights in an upstream source.

> **Release status:** the runtime contract below is being implemented and verified on the
> development branch. Until a release explicitly includes it, these commands describe the target
> interface rather than a production-ready deployment.

## Profiles

| Profile | Start command | Provider access | Evidence retained |
| --- | --- | --- | --- |
| `catalogue` | `docker compose up --build -d` | Disabled | None; serves local catalogue artifacts |
| `observe` | `docker compose --profile observe up --build -d` | Explicit opt-in | Digests and quality metadata only |
| `fabric` | `docker compose --profile observe --profile fabric up --build -d` | Explicit opt-in plus source approval | Raw evidence where the source policy allows it |

The intended activation flags are:

```dotenv
HKOD_ENABLE_PROVIDER_ACCESS=false
HKOD_ENABLE_RAW_EVIDENCE=false
```

Provider access must remain off unless the operator changes the first flag deliberately. Raw
evidence must remain off unless both flags are enabled and the individual source has a recorded
approval compatible with the proposed collection, caching, retention, attribution, and reuse.

## Target components

- **P01 Public Data Fabric:** normalized, read-only REST endpoints, SDKs, and read-only MCP tools
  backed by the generated resource catalogue.
- **P14 API Quality Observatory:** scheduled or on-demand local probes that record reachability,
  latency, schema, and freshness evidence without asserting provider uptime or production fitness.
- **PostgreSQL:** runtime metadata and observation indexes.
- **Object storage:** optional raw evidence for the `fabric` profile only.

## Operating boundaries

- Treat every source as disabled until explicitly enabled.
- Verify current provider terms and dataset-specific conditions before any request.
- Do not use a catalogue evidence state as permission for commercial use, caching, redistribution,
  automated collection, or personal-data processing.
- Keep secrets outside version control and rotate any credential exposed to logs or issues.
- Apply rate limits and retention periods that match current upstream requirements.
- Do not expose the runtime publicly without authentication, network controls, monitoring, backups,
  and an operator-owned security review.

Local test success demonstrates only the tested checkout and environment. It does not qualify a
deployment, approve a source, or replace upstream authorization.
