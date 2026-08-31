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
