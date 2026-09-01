# Runtime contracts

These project-authored contracts define the optional data access and API health interfaces. The
source-group and monitor registries are specifications only: every row starts in
`specified_pending_approval`, which means no external request or data collection is enabled. It also
does not grant permission for caching, retention, redistribution, or production use.

- `p01-source-groups.csv`: ten normalized source groups.
- `p14-monitor-targets.csv`: fifty bounded monitor definitions.
- `openapi.json`: versioned REST surface.
- `mcp-tool-contract.md`: thirteen read-only MCP tools.
- `*.schema.json`: runtime event, observation, incident, connector, and allowlist schemas.
- `contract-manifest.json`: SHA-256 integrity map regenerated from this directory.

Runtime references must resolve inside this repository. Current provider terms, per-source settings,
and the user's configuration still control execution. The `P01` and `P14` prefixes in stable file,
record, and API identifiers are retained for compatibility; public documentation uses descriptive
product names instead.
