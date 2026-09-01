# Release evidence

This append-only record distinguishes local verification from deployment, publication, provider
approval, and legal or independent acceptance. A passing command proves only the named checkout,
environment, and scope.

Evidence is added after a check completes. Release publication, GitHub Pages deployment, and any
external review are recorded separately rather than inferred from local results.

## 2026-08-31 — catalogue discovery documentation acceptance

- **Checkout:** `codex/build-v0.1.0`
- **Tested base commit:** `1a55fde283a4f62954653b13c11315cc6c803e50`
- **Environment:** macOS arm64; Node.js `v22.22.3`; pnpm `10.0.0`; uv `0.11.16`;
  uv-managed Python `3.12.11`; Playwright `1.58.2`
- **Generated catalogue:** 521 total; 265 official; 145 external; 111 MCP candidates
- **Rights-evidence distribution:** 331 ambiguity identified; 111 not reviewed; 79 restrictions
  identified

| Command | Observed result |
| --- | --- |
| `make verify-catalogue` | 13 catalogue tests passed; generated JSON current; README statistics current |
| `make verify-site` | 5 unit tests passed; TypeScript passed; static build generated 521 detail pages; 4 Chromium browser/accessibility/no-provider-traffic tests passed |
| `make test-repository` | 11 repository policy and documentation tests passed |
| `make check-boundary` | Passed with no reported private-path, excluded-state, or secret-pattern finding |
| `git diff --check` | Passed with no whitespace error |

This evidence qualifies the local catalogue and documentation worktree only. It does not record a
GitHub push, Pages deployment, release publication, provider approval, production deployment,
legal clearance, or independent acceptance. The optional data access and API health runtime was not in scope for this
entry and remains unqualified here.

## 2026-08-31 — v0.1.0 local publication candidate

- **Tested commit:** `825b01b4af95ef6e79b693f8749875702d6f09fe`
- **Branch:** `codex/build-v0.1.0`
- **Environment:** macOS arm64; Node.js `v22.22.3`; pnpm `10.0.0`; uv `0.11.16`;
  uv-managed Python `3.12.11`; Docker `29.7.2`; Compose `5.5.0`; Terraform `1.16.0`;
  Trivy `0.74.0`; GitHub CLI `2.92.0`; actionlint `1.7.12`
- **Catalogue:** 521 total; 265 official; 145 external; 111 MCP candidates
- **Terms reviews:** 330 ambiguity identified; 111 not reviewed; 80 restrictions identified

| Command or gate | Observed result |
| --- | --- |
| `make verify-all` | Passed: 18 catalogue tests; deterministic JSON and README counts; 5 catalogue unit tests; 521 static detail pages; 4 catalogue browser/accessibility/no-provider-traffic scenarios; all workspace tests, type checks and builds; Ruff and strict mypy; full Python suite with 2 expected Docker-only skips; secret and public-boundary scans; 18 repository policy tests |
| `pnpm exec playwright test` | 14/14 passed across catalogue, portal, admin, accessibility, mobile and desktop layouts; catalogue request assertions observed no automatic requests to listed providers |
| `make verify-integrated` | 9/9 Docker integration tests passed, including API/PostgreSQL and worker execution paths |
| `sh scripts/restore-drill.sh --local-compose` | Passed against an isolated `network none` target: migrations, row counts and raw hashes matched; zero raw objects; 10 source groups, 22 source definitions and 50 monitor targets restored; RPO 0.367 minutes; RTO 0.367 minutes; restore duration 22 seconds |
| Terraform format/init/validate | Passed; default deployment contract creates no cloud resource and leaves runtime and raw evidence disabled |
| actionlint `1.7.12` | Release checksum verified; every workflow passed semantic validation |
| `pnpm audit --audit-level high` and `uv run pip-audit` | No known vulnerabilities reported |
| Trivy filesystem vulnerability/secret/licence scan | Lockfiles reported zero high/critical vulnerabilities and no secret finding |
| Trivy configuration scan | Zero high/critical findings after the single path-scoped, expiring PostGIS bootstrap acceptance documented in `docs/security/RISK_ACCEPTANCES.md` |
| Trivy exact-image scans | Zero high/critical findings in `hk-open-data-api:0.1.0`, `worker:0.1.0`, `mcp:0.1.0`, `catalog:0.1.0`, `admin:0.1.0`, `portal:0.1.0`, and `postgres:16-3.5` |
| CycloneDX parsing and scan | Valid 1.6 document with 465 licensed components (403 npm and 62 Python); zero high/critical findings; no machine-specific checkout path |
| Full official-link observation | 270 observations: 262 successful and 8 LegCo connection failures from this host; superseded DATA.GOV.HK, CSDI/LandsD, ALS and HKO URLs corrected; zero records deleted |
| `sh scripts/package-release.sh 0.1.0` plus checksum verification | Clean-tree packaging passed; catalogue SHA-256 `cd7e7f1899dff1cf39e0bc51326d92529e771918b103c91a6f59587174c03c09`; SBOM SHA-256 `b461af9d580897ad53e6c2eb27ac820846a49dcebd7fe1d46d14db8c47b7900b` |

The first disposable restore-stack invocation deliberately failed closed because the audit command
supplied a hexadecimal-looking string where the documented input requires a base64 value decoding
to exactly 32 bytes. The stack was restarted with a correctly formatted test-only key, the complete
drill passed, and all audit containers, networks and named volumes were removed afterward.

This entry qualifies the named local commit and generated metadata package only. It does not record
a GitHub push, required hosted CI, Pages deployment, release publication, provider permission,
production deployment, legal clearance, or independent certification. Those outcomes require
separate evidence after they actually occur.

## 2026-08-31 — v0.1.0 rate-limit remediation candidate

- **Tested commit:** `307765e9043cab62a19a44c84c54d1c501e964de`
- **Branch:** `codex/fix-api-rate-limits`
- **Finding scope:** 23 open high-severity `js/missing-rate-limiting` CodeQL alerts observed on the
  prior public `main` revision `7261d172746108fb189e0e07e9db27d1fd78b748`
- **Control:** `@fastify/rate-limit` `11.2.0`, globally enforced before route handlers; exact trusted
  proxy addresses for the included admin and portal Nginx services; caller-supplied forwarding
  headers replaced at those proxies

| Command or gate | Observed result |
| --- | --- |
| Focused API, OpenAPI and MCP tests | Passed: requests 1–100 accepted and request 101 rejected; spoofed forwarding header could not reset a direct-client bucket; separate clients behind an explicit trusted proxy received separate buckets; rejection caused no repository side effect; `Retry-After`, correlation ID and retryable `RATE_LIMITED` envelope preserved; MCP emitted the safe retryable error |
| OpenAPI and contract drift | All 24 operations declare the shared `429` response; Swagger Parser validation passed; the eight-contract manifest hash matched |
| `make verify-all` | Passed after the final proxy change: deterministic 521-resource catalogue, browser/accessibility checks, 57 API tests with 3 intentional Docker-only skips, all workspace tests/type checks/builds, Python lint/type/tests, secret scan, public-boundary scan and repository policy tests |
| `make verify-integrated` | 10/10 Docker integration tests passed with the fixed edge subnet and trusted-proxy identities |
| Production dependency and Trivy scans | `pnpm audit --prod` reported no known vulnerability; lockfiles, repository-owned configuration outside the documented PostGIS bootstrap acceptance, and the CycloneDX SBOM reported zero high/critical findings |
| Independent security review | Literal `CLEAN`; prior OpenAPI type-cast and proxy shared-bucket findings verified resolved; hosted CodeQL remained an explicit post-merge gate |
| `sh scripts/package-release.sh 0.1.0` and checksum verification from `artifacts/` | Passed; 469 licensed CycloneDX 1.6 components (407 npm and 62 Python); catalogue SHA-256 `cd7e7f1899dff1cf39e0bc51326d92529e771918b103c91a6f59587174c03c09`; SBOM SHA-256 `0a8f8fe91fad4f176b62219194d6fb55cfe13145ad93c6b6735564a54bf79cfa` |

This entry qualifies the named local commit and regenerated package only. It does not claim the
hosted CodeQL alerts are closed, nor does it record merge, tag, release publication, provider
permission, production deployment, legal clearance, or independent certification. Release remains
blocked until protected-branch CI and hosted CodeQL succeed on the published candidate.

## 2026-08-31 — v0.1.0 public release

- **Published commit:** `63c85083485bb1b07676f55c8d08dfb12ecb8a55`
- **Merged change:** pull request `#17`, `security: enforce API request rate limits`
- **Immutable tag and release:** `v0.1.0`,
  <https://github.com/angusf777/hk-open-data/releases/tag/v0.1.0>
- **Pages deployment:** <https://angusf777.github.io/hk-open-data/>
- **Repository state:** public, Apache-2.0, Issues and Discussions enabled, HTTPS Pages, strict
  required status checks and linear history; force pushes and branch deletion disabled

| Published gate or observation | Observed result |
| --- | --- |
| Pull request `#17` | All eight reported checks passed, including catalogue, TypeScript, Python, browser, boundary, JavaScript/TypeScript CodeQL and Python CodeQL |
| Main CI run `33408418682` | Passed all five required jobs at the published commit |
| Main CodeQL run `33408418714` | JavaScript/TypeScript and Python analyses passed; the code-scanning API then reported zero open alerts, closing all 23 prior high-severity missing-rate-limit findings |
| Pages run `33408418679` | Build and deployment passed at the published commit |
| Release run `33408624340` | Verification, 10/10 Docker integration tests, packaging, checksum verification, immutable tag creation and GitHub Release publication all passed |
| Tag integrity | Annotated tag `v0.1.0` resolves to the same `63c8508` commit as published `main` |
| Published asset verification | A fresh download passed the attached `SHA256SUMS`; catalogue SHA-256 `cd7e7f1899dff1cf39e0bc51326d92529e771918b103c91a6f59587174c03c09`; Linux release-runner SBOM SHA-256 `76dd986437cc626395bc2d81481179b77d47c085046ce3fbf11d13760f747a2c`; 469 licensed CycloneDX 1.6 components |
| Live Pages browser check | HTTP 200; branded title; one-result source search; English and Traditional Chinese safeguards; direct static resource permalink; zero requests outside GitHub Pages; zero tested Axe WCAG violations on catalogue and detail; zero mobile overflow |
| Repository security APIs | Zero open code-scanning alerts and zero open secret-scanning alerts |

This entry records actual GitHub publication and observed live Pages behaviour. It does not imply
provider permission, legal clearance, current source accuracy, production operation of the
optional API/MCP runtime, service availability, or independent certification. The static catalogue
remains an independent community project; original sources and current terms remain controlling.

## 2026-09-01 — source-access compatibility evidence

- **Tested base commit:** `0eb05aad8609e1a607fa5b62fea0c247410aed5b`
- **Branch:** `codex/source-access-toolkit-implementation`
- **Environment:** macOS arm64; Node.js `v22.22.3`; pnpm `10.0.0`; uv `0.11.16`;
  uv-managed Python `3.12.11`
- **Official access registry:** 265 classified; 37 executable and synthetic-fixture-tested;
  228 manual guidance entries; zero unclassified
- **Bounded live run:** 37 anonymous recipes attempted sequentially; 29 succeeded and were
  re-verified against their promoted recipe hashes; 8 retained as fixture-tested with safe failure
  evidence
- **Effective status after generation:** 29 live-verified; 8 fixture-tested; 228 manual-only;
  zero credential-required, blocked or unavailable

| Command or review | Observed result |
| --- | --- |
| `uv run pytest tests/access/test_live_smoke.py -q` | Skipped by default; no provider request without explicit opt-in |
| `RUN_LIVE_ACCESS_TESTS=1 uv run pytest tests/access/test_live_smoke.py -q -s` | Passed and wrote metadata-only evidence for all 37 anonymous executable recipes |
| Per-source hash refresh for 29 successful recipes | Each promoted recipe was re-verified successfully after its status change altered the canonical recipe SHA-256 |
| `uv run pytest tests/access -q` | 75 passed and 1 expected live-only skip |
| Ruff and strict mypy for the access script, live helper, CLI and access tests | Passed |
| `node scripts/check-secrets.mjs` and evidence key/content review | Passed; 37 evidence files contained only approved metadata fields, with no response body or credential material |
| `uv run python scripts/access.py check` and `uv run python scripts/catalog.py check` | Passed; generated access and catalogue projections matched the current recipes and evidence |

The eight retained failures are HKAPI-018 (`MEDIA_TYPE_MISMATCH`) and HKAPI-020, HKAPI-163,
HKAPI-164, HKAPI-165, HKAPI-166, HKAPI-167 and HKAPI-169 (`SOURCE_UNAVAILABLE` from the verifying
Python TLS trust path). TLS verification was not weakened. These results describe one bounded run
from this host; evidence expires at each record's `validUntil` timestamp and does not guarantee
future availability, provider approval, data quality, licensing, or permission for commercial use,
caching, scraping or redistribution.

## 2026-09-01 — source-access toolkit local release qualification

- **Tested tree base:** `b58a19bc6ca772953959594b38d9c0411d9c6d41`
- **Branch:** `codex/source-access-toolkit-implementation`
- **Environment:** macOS arm64; Node.js `v22.22.3`; pnpm `10.0.0`; uv `0.11.16`;
  Docker `29.7.2`; Compose `5.5.0`
- **Catalogue:** 521 resources; 265 official; ten shown initially
- **Access registry:** 265 classified; 37 executable; 29 live-verified; 8 fixture-tested;
  228 manual-only; zero unclassified
- **Contract manifest:** `2026-09-01.v1`; eight synchronized contracts

| Command or gate | Observed result |
| --- | --- |
| `make verify-all` | Passed: deterministic 521-resource catalogue and 265-recipe registry; 6/6 Chromium catalogue/accessibility scenarios; all workspace tests, type checks and builds; Ruff; strict mypy; full Python suite; secret and public-boundary scans; 25/25 repository policy tests |
| `make verify-integrated` | Passed: 3/3 PostgreSQL 16/PostGIS tests, 1/1 synthetic connector raw-byte persistence test, and 13/13 Docker/Compose integration tests |
| Docker profile checks | The API and web health checks passed; the optional observation and data-access profiles started with zero active sources; the data-access profile used private object storage; REST and MCP HKAPI-001 recipe hash/status matched the generated registry |
| `node scripts/check-contract-drift.mjs` | Passed; all eight contract hashes matched the manifest |
| `pnpm audit --prod` | No known production dependency vulnerabilities reported |
| `uv run pip-audit` | No known vulnerabilities reported for published Python dependencies; the two repository-local packages were correctly skipped because they are not PyPI distributions |
| `node scripts/check-secrets.mjs` and public-boundary checks | Passed; metadata-only source evidence and public files met the repository safeguards |
| `git diff --check` | Passed with no whitespace error before the qualification record was added |

Two stale unit expectations were found and corrected during the broad gate after HKAPI-001 moved
from fixture-tested to live-verified. The isolated database test was also aligned with the hardened
image's required runtime-role passwords. Focused tests passed after each correction, followed by
the complete green gates above.

This entry qualifies the local source-access toolkit tree only. It does not record a GitHub push,
hosted CI, Pages deployment, tag, release publication, source-owner permission, production
deployment, legal clearance, or independent acceptance. Live-verification evidence is bounded to
the recorded date and validity period; original source terms remain controlling.

## 2026-09-01 — DATA.GOV.HK source resolver expansion

- **Tested tree base:** `df2dced409fc70513d638752f46b48e8e32c0e3c`
- **Branch:** `codex/source-access-toolkit-implementation`
- **Environment:** macOS arm64; Node.js `v22.22.3`; pnpm `10.0.0`; uv `0.11.16`;
  uv-managed Python `3.12.11`; Docker `29.7.2`; Compose `5.5.0`
- **Official access registry:** 265 classified; 227 executable; 219 live-verified; eight
  fixture-tested with recorded live failures; 38 manual-only; zero unclassified
- **DATA.GOV.HK mapping:** 190 source records; 356 reviewed source-to-dataset mappings; 350 unique
  official dataset identifiers

| Command or gate | Observed result |
| --- | --- |
| Dataset-level `data_gov_recipes.py --verify-all-datasets --concurrency 3` run | All 350 allowlisted DATA.GOV.HK dataset identifiers returned valid `package_show` metadata; the published manifest contains metadata and hashes, not provider response bodies |
| `hkdata verify --all-anonymous --concurrency 3` run plus hash refresh | 219 recipes retained matching successful live evidence; the eight known direct-response failures remained fixture-tested and their TLS/media-type safeguards were not weakened |
| Catalogue link-health run at concurrency three | 526 observations and 29 findings: 262/270 official links, 128/145 external links and 107/111 community MCP repository links were reachable or followed a valid redirect; five external and four MCP records with definite HTTP 404 results were marked unavailable |
| `make verify-all` | Passed: deterministic catalogue/access projections, 6/6 browser and accessibility scenarios, contract drift, all workspace tests/type checks/builds, Ruff, strict mypy, the full Python suite, secret scan, public-boundary scan and 25/25 repository policy tests |
| `make verify-integrated` | Passed: 3/3 PostgreSQL/PostGIS API tests, 1/1 raw-byte persistence integration test and 13/13 Docker/Compose integration tests, including the repository's read-only REST and MCP surfaces |
| `git diff --check` | Passed with no whitespace errors after this qualification record was completed |

The 190 `data-gov-resource-index` recipes resolve reviewed official dataset identifiers to current
resource names, formats and URLs. Their successful checks establish package-metadata compatibility;
they do not establish that every linked CSV, JSON feed, geospatial service, download or downstream
API was fetched, parsed, semantically validated or continuously available.

The external and community MCP collections remain catalogue entries, not bundled connectors. The
link-health run did not authenticate to external APIs or install and execute third-party MCP code.
No technical or link check grants permission for commercial use, caching, redistribution, scraping,
personal-data processing or any other proposed use. Current provider terms, licences, technical
controls and applicable law remain controlling. This record does not establish a GitHub push,
hosted CI, Pages deployment, release publication, provider approval or independent certification.
