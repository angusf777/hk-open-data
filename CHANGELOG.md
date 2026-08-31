# Changelog

All notable project changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses semantic versioning.

## [Unreleased]

## [0.1.0] - Unreleased

### Added

- Searchable static catalogue containing 521 evidence-labelled resources: 265 official, 145
  external, and 111 read-only MCP candidates.
- English and Traditional Chinese catalogue experience with deterministic resource permalinks.
- Optional fail-closed P01/P14 runtime profiles for catalogue-only, digest-only observation, and
  separately approved raw evidence.
- REST and TypeScript/Python SDK surfaces plus 11 read-only MCP tools.
- Synthetic connector fixtures, source-rights safeguards, corrections, security policy, CI,
  scheduled health evidence, Pages deployment, and metadata-only release packaging.

### Security

- Provider access is disabled by default; runtime services use bounded, non-root, read-only
  containers and explicit egress boundaries.

[Unreleased]: https://github.com/angusf777/hk-open-data/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/angusf777/hk-open-data/releases/tag/v0.1.0
