# Runtime contracts

These project-authored contracts pin the optional P01/P14 runtime interfaces. The source-group and
monitor registries are specifications only: every row starts in
`specified_pending_approval` and does not authorize a provider request, collection, caching,
retention, redistribution, or production use.

- `p01-source-groups.csv`: ten normalized source groups.
- `p14-monitor-targets.csv`: fifty bounded monitor definitions.
- `openapi.json`: versioned REST surface.
- `mcp-tool-contract.md`: eleven read-only MCP tools.
- `*.schema.json`: runtime event, observation, incident, connector, and allowlist schemas.
- `contract-manifest.json`: SHA-256 integrity map regenerated from this directory.

Runtime references must resolve inside this repository. Current upstream terms, source-specific
approvals, and operator configuration still control execution.
