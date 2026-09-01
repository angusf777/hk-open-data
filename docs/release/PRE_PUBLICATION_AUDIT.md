# v0.1.0 pre-publication audit

Date: 2026-08-31  
Scope: public repository, static catalogue, optional self-hosted data access and API health tools,
and metadata-only release package

This audit is a release checklist, not legal advice, provider authorization, a production service
qualification, or an independent security certification. Provider terms, dataset-specific terms,
technical controls, and applicable law remain controlling.

## Product boundary

- The public product is a static, bilingual metadata catalogue and open-source self-hosting toolkit.
- The project does not host, proxy, sell, sublicense, or redistribute provider API or dataset
  payloads.
- The default `catalogue` mode makes no requests to listed data providers.
- API health checks (`observe`) and data access (`fabric`) must be selected explicitly; all included
  sources and connectors remain inactive.
- API health checks store bounded metadata and fingerprints. Data access may store complete
  responses only after the person running the toolkit records a source-specific review and
  configures retention and storage controls.
- The Pages workflow publishes only `apps/catalog/dist`; it contains no server runtime, secrets,
  provider payloads, or analytics.

## Catalogue and terms reviews

- 521 records: 265 official, 145 external, and 111 MCP candidates.
- Terms-review states: 330 `ambiguity-identified`, 111 `not-reviewed`, and 80
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
promise, and any provider page can change after this audit.

## Runtime safeguards

- API, worker, MCP, portal, and admin processes run as non-root users.
- Public edge exposure is restricted to the configured web entry points; PostgreSQL and object
  storage are not published by the release Compose topology.
- External requests are off by default, protected against SSRF, bounded by size and timeout, and
  require the relevant mode, source activation, review, and recorded rule version.
- REST and SDK surfaces are bounded; the thirteen MCP tools are read-only.
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

## 2026-09-01 source-access toolkit addendum

The source-access expansion is locally qualified for a future release with these public boundaries:

- All 265 official catalogue entries have source-specific access guidance. Thirty-seven have
  executable, read-only request recipes with deterministic curl, Python and TypeScript examples;
  228 provide manual guidance to the source's official documentation.
- A bounded anonymous check on 2026-09-01 verified 29 executable recipes. Eight remain supported by
  synthetic fixtures only. These labels are dated technical evidence, not an uptime promise or a
  permission statement.
- The catalogue shows ten resources initially and can filter by access evidence. It does not contact
  a listed source unless a person deliberately uses an example or verification command.
- REST and both SDKs expose the same generated recipes. The two MCP recipe tools list or retrieve
  guidance only and cannot execute a source request.
- The default self-hosted profile serves the catalogue without source requests. The two optional
  profiles require an explicit selection; every included source and connector remains inactive
  until separately configured.
- The data-access profile keeps its object store private. Container checks confirmed that both
  optional profiles start with zero active sources and that REST and MCP return the same recipe hash
  and evidence status as the generated registry.

Local qualification covered the complete repository gate, the PostgreSQL/PostGIS migration and
isolation tests, synthetic connector raw-byte persistence, both Docker profiles, REST/MCP parity,
browser and accessibility behavior, dependency audits, deterministic generation, and secret and
public-boundary scans. The exact commands and observed results are recorded in
`RELEASE_EVIDENCE.md`.

This addendum does not amend source terms or grant permission to use, cache, scrape, combine,
redistribute, or commercialize any third-party content. It also does not record a GitHub push,
hosted CI result, Pages deployment, release publication, source-owner approval, production
operation, legal clearance, or independent certification.
