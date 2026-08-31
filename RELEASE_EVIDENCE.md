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
legal clearance, or independent acceptance. The optional P01/P14 runtime was not in scope for this
entry and remains unqualified here.

## 2026-08-31 — v0.1.0 local publication candidate

- **Tested commit:** `825b01b4af95ef6e79b693f8749875702d6f09fe`
- **Branch:** `codex/build-v0.1.0`
- **Environment:** macOS arm64; Node.js `v22.22.3`; pnpm `10.0.0`; uv `0.11.16`;
  uv-managed Python `3.12.11`; Docker `29.7.2`; Compose `5.5.0`; Terraform `1.16.0`;
  Trivy `0.74.0`; GitHub CLI `2.92.0`; actionlint `1.7.12`
- **Catalogue:** 521 total; 265 official; 145 external; 111 MCP candidates
- **Rights evidence:** 330 ambiguity identified; 111 not reviewed; 80 restrictions identified

| Command or gate | Observed result |
| --- | --- |
| `make verify-all` | Passed: 18 catalogue tests; deterministic JSON and README counts; 5 catalogue unit tests; 521 static detail pages; 4 catalogue browser/accessibility/no-provider-traffic scenarios; all workspace tests, type checks and builds; Ruff and strict mypy; full Python suite with 2 expected Docker-only skips; secret and public-boundary scans; 18 repository policy tests |
| `pnpm exec playwright test` | 14/14 passed across catalogue, portal, admin, accessibility, mobile and desktop layouts; catalogue request assertions observed no provider traffic |
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
provider permission, legal clearance, current upstream accuracy, production operation of the
optional API/MCP runtime, service availability, or independent certification. The static catalogue
remains an independent community project; upstream sources and current terms remain controlling.
