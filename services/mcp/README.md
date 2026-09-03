# HK Public Data read-only MCP

This project-provided server exposes the fifteen tools pinned in
[`packages/schemas/contracts/mcp-tool-contract.md`](../../packages/schemas/contracts/mcp-tool-contract.md).
It calls only the
platform REST service; it does not fetch provider URLs, return raw object bodies, or expose writes.

The HTTP container is an internal/loopback service. Any internet-facing self-hosted deployment must
place it behind authentication you control, pass a short-lived audience-bound bearer token
for each authorized caller, and keep the container port private.

## Configuration

- `PLATFORM_API_URL`: required HTTPS REST base URL ending in `/v1`.
- `PLATFORM_API_TOKEN`: stdio only; optional caller-scoped bearer token. Omit only for public access.
- `MCP_PORT`: optional loopback HTTP port, default `3100`.

## Stdio

```sh
PLATFORM_API_URL=https://platform.example/v1 \
PLATFORM_API_TOKEN=replace-with-secret-reference \
pnpm --filter @hk-open-data/mcp start:stdio
```

Stdout is reserved for MCP protocol messages. Runtime notices use stderr.

## Streamable HTTP

```sh
PLATFORM_API_URL=https://platform.example/v1 \
pnpm --filter @hk-open-data/mcp start:http
```

The HTTP transport forwards each request's bearer token to the REST API. It does not use a
process-wide platform token, so REST and MCP apply the same audience, expiry and scope policy for
the same caller. Place any public endpoint behind an identity-aware gateway you manage.

The server binds `127.0.0.1:3100/mcp` and applies localhost Host and Origin validation. Put an
authenticated, TLS-terminating gateway in front of it for any remote deployment.

## Source-access recipe tools

- `access_recipes_list` reads the REST recipe list with optional status, adapter, authentication,
  freshness and page filters.
- `access_recipe_get` reads one recipe by `HKAPI-NNN` source reference.
- `access_resources_list` reads bounded exact resource URLs/templates for one `HKAPI-NNN` source.
- `access_resource_get` reads one resource by dataset ID and resource ID, including required
  parameters and local CLI usage.

All four access tools are read-only and return repository-authored instructions and metadata-only evidence.
The MCP server does not execute a listed source, accept an arbitrary source URL, or return stored
source response bodies. Run `hkdata recipe HKAPI-001`, `hkdata example HKAPI-001 python`, and
`hkdata verify HKAPI-001` through the local CLI when that is your deliberate intent.

## Verification

```sh
pnpm --filter @hk-open-data/mcp test
pnpm --filter @hk-open-data/mcp typecheck
pnpm --filter @hk-open-data/mcp build
npx @modelcontextprotocol/inspector --cli node services/mcp/dist/stdio.js \
  -e PLATFORM_API_URL=https://platform.example/v1 \
  --method tools/list --strict --format json
```

The test suite checks the exact tool list, strict input schemas, pinned tool fingerprint,
structured evidence output, 25,000-character cap, prohibited-tool absence, modern HTTP behavior,
and twelve deterministic evaluation questions.
