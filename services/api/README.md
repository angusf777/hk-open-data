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

## Request limiting

The API applies a global limit of 100 requests per minute to each source IP. An exhausted client
receives HTTP `429`, a `Retry-After` header and the standard `RATE_LIMITED` error envelope. Proxy
trust is disabled unless `TRUSTED_PROXY_CIDRS` contains explicit comma-separated addresses or
CIDRs. The included Compose topology assigns fixed addresses only to its admin and portal Nginx
proxies; each proxy replaces (rather than appends) `X-Forwarded-For` with its direct client address.
Direct API and MCP peers are not trusted to supply forwarding headers.

Counters are stored in each API process. The included single-instance Docker Compose topology is
therefore the supported default. Before exposing multiple API replicas or serving many users behind
one reverse-proxy address, deploy a shared edge or distributed rate limiter and document the trusted
proxy boundary. Never trust forwarding headers from a CIDR that untrusted clients can reach as a
direct peer, and configure each trusted proxy to replace caller-supplied forwarding headers.
