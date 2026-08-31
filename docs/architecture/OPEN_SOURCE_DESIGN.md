# Open-source design

## Product boundary

HK Open Data publishes a curated metadata catalogue and source code for an optional self-hosted
toolkit. The project does not host, proxy, sell, sublicense, or redistribute upstream datasets or API
responses. It does not offer user accounts, paid access, provider credentials, analytics, or visitor
tracking. It is independent of the Hong Kong Government and listed providers.

The public repository contains only material intended for open publication: project-authored code
and documentation, factual catalogue metadata, minimal source-derived descriptions, and links to
authoritative pages. Private research workspaces, internal planning, credentials, personal data,
provider payloads, and substantial copies of upstream documentation are excluded by policy and a
repository boundary scan.

## One catalogue, two consumers

Versioned YAML is the only hand-edited catalogue source. Deterministic JSON is consumed by:

1. a static, bilingual discovery site that makes no provider requests; and
2. an optional local P01/P14 runtime that starts fail-closed and requires explicit profiles and
   per-source authorization before provider access.

Keeping one generated input prevents the website and runtime from quietly diverging about source
identity, evidence dates, or rights states.

## Publication guarantees

A release candidate must demonstrate:

- schema-valid, deterministically regenerated catalogue artifacts;
- drift-free generated counts and README statistics;
- unit, type, build, browser, accessibility, and no-provider-traffic checks;
- runtime unit and contract tests for any included runtime component;
- fail-closed Docker profile behaviour;
- a public-boundary and secret scan;
- a release evidence record tied to the tested commit.

Passing local tests is necessary but not equivalent to a secure public deployment, provider
approval, legal clearance, or independent acceptance.

## Rights and representation

The Apache-2.0 licence applies to project-authored material. It does not relicense upstream data,
APIs, names, marks, documentation, or services. Catalogue inclusion and evidence labels are not
endorsements or legal opinions. Current upstream terms, dataset-specific conditions, technical
controls, and applicable law control every actual use, including commercial use, caching,
redistribution, scraping, attribution, and personal-data processing.

Corrections and takedowns follow a documented, evidence-backed process. Security reports use a
private channel so credentials, vulnerabilities, and sensitive data are not exposed in public
issues.
