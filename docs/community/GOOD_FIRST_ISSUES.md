# Good first contributions

These are deliberately small, evidence-backed tasks that can be completed independently. Check
the linked GitHub issue before starting so two people do not duplicate the same work.

## 1. Verify and correct one catalogue link

Choose one source marked stale or unavailable, open the authoritative provider page, and update
only the URL, dated verification evidence, and generated catalogue output. Do not copy provider
content. Success is `make verify-catalogue` passing with the source link cited in the pull request.

## 2. Add a missing official public-data source

Use the resource-request template first. Add one YAML record with authoritative landing,
documentation, and terms links; factual access metadata; and an honest terms-review state. Do not
claim permission from technical availability. Success is one validated record and its generated
output.

## 3. Add a browser accessibility regression test

Pick one existing keyboard or screen-reader interaction in the catalogue, reproduce the expected
behaviour in Playwright, and add the smallest regression test. Success is `make verify-site`
passing without changing unrelated layout.

## 4. Improve one evidence-backed quickstart

Choose an existing guide in `docs/quickstarts/`, improve an unclear instruction or troubleshooting
case, and keep all commands generated from current project evidence. Success is
`pnpm quickstarts:check` passing and the evidence boundary remaining intact.

## 5. Document one provider-resource format

Choose a current format from the provider-resource inventory and add a short, bounded parsing note
using a synthetic example. Do not commit a provider payload. Success is a reproducible example,
test coverage, and a link to the provider's technical documentation.

## 6. Improve metadata export usability

Add a tested example that queries `sources.csv`, `provider-resources.csv`, or
`hk-open-data.sqlite`. The example must use project metadata only and must explain that provider
terms still govern use of upstream datasets.

## Start here

Read [CONTRIBUTING.md](../../CONTRIBUTING.md), comment on the matching issue, and keep the pull
request focused on one task. Maintainers may adjust scope if the provider changed after the issue
was written.
