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
