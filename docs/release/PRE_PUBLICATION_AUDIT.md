# v0.1.0 pre-publication audit

Date: 2026-08-31  
Scope: public repository, static catalogue, optional self-hosted P01/P14 toolkit, and metadata-only
release package

This audit is a release checklist, not legal advice, provider authorization, a production service
qualification, or an independent security certification. Provider terms, dataset-specific terms,
technical controls, and applicable law remain controlling.

## Product boundary

- The public product is a static, bilingual metadata catalogue and open-source self-hosting toolkit.
- The project does not host, proxy, sell, sublicense, or redistribute upstream API or dataset
  payloads.
- The default `catalogue` profile performs no provider requests.
- `observe` and `fabric` are explicit operator choices; all seeded sources and connectors remain
  inactive.
- `observe` stores bounded metadata and digests. `fabric` permits raw evidence only after the
  operator records source-specific approval and configures retention and storage controls.
- The Pages workflow publishes only `apps/catalog/dist`; it contains no server runtime, secrets,
  provider payloads, or analytics.

## Catalogue and rights evidence

- 521 records: 265 official, 145 external, and 111 MCP candidates.
- Rights-evidence states: 330 `ambiguity-identified`, 111 `not-reviewed`, and 80
  `restriction-identified`.
- All 521 Traditional Chinese descriptions are marked `seeded`; no human-review claim is made.
- Evidence labels describe dated source research. They never mean commercial use, caching,
  redistribution, scraping, attribution, privacy processing, or another proposed use is permitted.
- The 2026-08-31 live link pass checked 270 official record links: 262 succeeded and eight LegCo
  links failed from the release host with connection errors. Current, resource-specific LegCo URLs
  were separately located on the official domain. No record was silently deleted.
- Superseded DATA.GOV.HK, CSDI/LandsD, ALS, and HKO links were replaced with current official
  documentation. The Topographic Map API record now exposes the identified attribution, copyright,
  traffic, imagery, and TLS conditions and links the CSDI terms.

Link reachability is operational evidence only. It is neither a rights determination nor an uptime
promise, and any upstream page can change after this audit.

## Runtime safeguards

- API, worker, MCP, portal, and admin processes run as non-root users.
- Public edge exposure is restricted to the configured web entry points; PostgreSQL and object
  storage are not published by the release Compose topology.
- Provider fetching is fail-closed, SSRF guarded, size and timeout bounded, and gated by profile,
  source activation, approval, and immutable rule-version evidence.
- REST and SDK surfaces are bounded; the eleven MCP tools are read-only.
- Synthetic connector fixtures carry checksums and provenance. No provider payload is included in
  the repository or release artifacts.
- Restore verification compares migrations, row counts, hashes, object evidence, RPO, and RTO in an
  isolated target.

## Supply chain and security

- JavaScript and Python lockfiles are frozen; GitHub Actions are pinned to full commit hashes.
- The CycloneDX 1.6 SBOM contains all 465 installed components observed for this release: 403 npm
  and 62 Python distributions. Every component carries declared licence metadata.
- Dependency, filesystem, secret, configuration, and exact tagged image scans are release gates.
- One narrow, documented Trivy configuration acceptance applies to the official PostGIS bootstrap
  entrypoint and expires on 2027-08-31. It does not waive host, deployment, secret, backup, or
  network controls. See `docs/security/RISK_ACCEPTANCES.md`.
- Repository bootstrap applies required CI checks and linear history without requiring a fictitious
  second maintainer.

## Release contents

The v0.1.0 release contains metadata only:

- `hk-open-data-catalogue-v0.1.0.json`
- `hk-open-data-sbom-v0.1.0.cdx.json`
- `SHA256SUMS`

The package deliberately excludes provider payloads, database dumps, object-store contents,
credentials, Terraform state, local environment files, logs, caches, and private planning material.

## Acceptance boundary

Local test and scan results are recorded in `RELEASE_EVIDENCE.md`. GitHub publication, required CI,
Pages deployment, release creation, and live acceptance must be recorded separately after they
actually occur. A local green suite does not imply those external outcomes.
