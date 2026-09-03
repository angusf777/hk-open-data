# Changelog

All notable project changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses semantic versioning.

## [Unreleased]

### Added

- Complete source-access registry for all 265 official catalogue records: 37 bounded executable
  recipes with curl, Python and TypeScript examples plus hashed synthetic fixtures, and 228
  source-specific manual guides.
- Local `hkdata recipe`, `example`, `fetch` and `verify` commands with typed parameters, stable exit
  codes, request safety limits, and metadata-only verification evidence.
- Catalogue access panels and filters, two REST recipe routes, Python and TypeScript SDK recipe
  methods, and the read-only MCP tools `access_recipes_list` and `access_recipe_get`.
- English and Traditional Chinese source-access guides, generated per-source status documentation,
  and refreshed evidence from a bounded 227-recipe check on 3 September 2026.
- Reproducible inventory of 5,862 provider resources from all 350 reviewed DATA.GOV.HK package
  identifiers, including exact URL templates, required parameters, formats and source mappings.
- Guarded `hkdata resources`, `resource-example` and `fetch-resource` commands; corresponding REST,
  Python SDK, TypeScript SDK and read-only MCP resource-discovery surfaces.
- Metadata-only evidence from a bounded representative payload check of all 350 mapped datasets,
  with 310 successes and every current failure or non-probeable dataset published.
- Bilingual provider-resource browser with local search and filters, parameter-aware cURL, Python,
  Node and `hkdata` commands, source-scoped links and fail-closed handling of unsafe URLs.

### Changed

- The MCP contract now pins exactly 15 read-only tools at version `2026-09-01.v1`.
- Catalogue connector labels are derived from each source's effective recipe status.
- Recipe generation preserves independently generated provider-resource artifacts.

### Security

- Recipe execution requires explicit CLI or per-source runtime action and enforces HTTPS, exact
  host allowlists, bounded parameters, timeouts, response sizes, retry limits and redirect checks.
- Live checks retain hashes and technical metadata rather than source response bodies or
  credentials. Technical success does not grant usage rights or provider approval.

## [0.1.0] - 2026-08-31

### Added

- Searchable static catalogue containing 521 evidence-labelled resources: 265 official, 145
  external, and 111 read-only MCP candidates.
- English and Traditional Chinese catalogue experience with deterministic resource permalinks.
- Optional self-hosted modes for catalogue-only use, API health checks that store fingerprints and
  summaries, and data access with full-response storage. Every external connection starts disabled.
- REST and TypeScript/Python SDK surfaces plus 11 read-only MCP tools.
- Synthetic connector fixtures, source-rights safeguards, corrections, security policy, CI,
  scheduled health evidence, Pages deployment, and metadata-only release packaging.

### Security

- Provider access is disabled by default; runtime services use bounded, non-root, read-only
  containers and explicit egress boundaries.

[Unreleased]: https://github.com/angusf777/hk-open-data/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/angusf777/hk-open-data/releases/tag/v0.1.0
