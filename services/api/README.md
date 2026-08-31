# API service

Fastify service for the self-hosted P01/P14 REST contract, audited administration and optional
webhook delivery. It uses
PostgreSQL for durable state, validates OIDC bearer tokens against pinned issuer/audience/JWKS
metadata, enforces the seven normative scopes and requires MFA plus a reason for administrative
mutations. Public projections redact private endpoint, note and raw-object fields.

The migration chain creates registry, evidence, records, events, monitor, incident, scoped webhook,
scheduler and audit tables; row-level isolation policies, immutable raw/audit triggers and runtime
kill switches are included. Seed definitions remain inactive until a local operator records the
required evidence and activation decision.

```sh
pnpm --filter @hk-open-data/api test
pnpm --filter @hk-open-data/api typecheck
pnpm --filter @hk-open-data/api build
DATABASE_URL=postgresql://... pnpm --filter @hk-open-data/api migrate
DATABASE_URL=postgresql://... pnpm --filter @hk-open-data/api seed
```

Runtime also requires `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` and a base64 32-byte
`WEBHOOK_SECRET_ENCRYPTION_KEY`. Use Docker Compose for the integrated topology.
