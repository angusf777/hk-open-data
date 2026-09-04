# Contributing to HK Open Data

Thank you for improving this independent Hong Kong open-data catalogue and self-hosted toolkit. Contributions can be as small as correcting one URL or as substantial as adding a tested connector.

## Ways to contribute

- Request or correct a resource through a structured GitHub issue.
- Improve factual catalogue metadata or public documentation.
- Add one validated YAML resource record.
- Improve documentation, accessibility, tests, SDKs or read-only MCP tools.
- Add a connector using synthetic test data, with the connection off until a user enables it.

## Catalogue metadata

Prefer one resource per pull request when practical. Use factual, source-attributed language. Every
published record needs a stable ID, bilingual name and summary, provider, category, access facts,
authoritative links, verification date, and terms-review state.

Do not copy complete datasets, substantial provider documentation, government or provider logos, credentials, access tokens, personal data, production logs or restricted samples into an issue or pull request.

## Source terms review

The `termsEvidence` field records what an authoritative page stated on a particular date. Its public
label is **Terms review** because it is research, not permission. Link the provider's current terms
where possible, identify explicit restrictions or unanswered questions neutrally, and keep
dataset-specific terms separate from platform-wide terms.

## Public language

Write for someone encountering the project for the first time. Use **data access toolkit** and
**API health monitor** instead of internal portfolio codes. Introduce a technical setting such as
`observe` or `fabric` by explaining what it does. Prefer direct phrases such as “connections are off
until you enable them” over internal governance shorthand. Stable API fields, runtime IDs, and file
names remain unchanged for compatibility.

Run:

```bash
uv run python scripts/catalog.py validate
uv run python scripts/catalog.py generate
uv run python scripts/catalog.py check
```

## Bilingual fields

Preserve official names where available. Mark seeded Traditional Chinese text as seeded until a fluent reviewer confirms it. Do not hide a missing translation by claiming it was reviewed.

Translation review is welcome but is not a prerequisite for taking on other issues. Keep an
existing translation status unchanged unless the pull request actually provides the stated level
of review.

## Pick a first task

Start with the [scoped good-first contribution list](docs/community/GOOD_FIRST_ISSUES.md) and the
matching labelled issue. Comment before starting, keep the pull request to one outcome, and cite
the authoritative source used for any factual change. Questions and early proposals are welcome in
[GitHub Discussions](https://github.com/angusf777/hk-open-data/discussions).

## Code and tests

Use the locked project-local toolchains. Add a failing test first, implement the smallest focused change, and run the relevant checks. Before requesting review, run `make verify-all` when the complete runtime is available.

## Contribution licence

By submitting a contribution, you agree that it is licensed under the Apache License 2.0 on the same terms as the repository. Do not submit material you do not have the right to contribute. No separate contributor licence agreement is required at launch.

## Privacy and secrets

Never include credentials or non-public data. Report security vulnerabilities privately as described in [SECURITY.md](SECURITY.md). Use the correction and takedown process for rights, attribution or catalogue disputes.

For setup questions and the expected response boundary, see [SUPPORT.md](SUPPORT.md).
