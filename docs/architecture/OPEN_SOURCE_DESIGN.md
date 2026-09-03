# Open-source design

## Product boundary

HK Open Data publishes a curated metadata catalogue and source code for an optional self-hosted
toolkit. The project does not host, proxy, sell, sublicense, or redistribute provider datasets or API
responses. It does not offer user accounts, paid access, provider credentials, analytics, or visitor
tracking. It is independent of the Hong Kong Government and listed providers.

The public repository contains only material intended for open publication: project-authored code
and documentation, factual catalogue metadata, minimal source-derived descriptions, and links to
authoritative pages. Private research workspaces, internal planning, credentials, personal data,
provider payloads, and substantial copies of provider documentation are excluded by policy and a
repository boundary scan.

## One catalogue and one access registry

Versioned YAML is the only hand-edited catalogue source. Deterministic JSON is consumed by:

1. a static, bilingual discovery site that makes no provider requests; and
2. an optional self-hosted toolkit whose external data connections stay off until the user chooses
   a mode and enables an individual source.

Keeping one generated input prevents the website and runtime from quietly diverging about source
identity, evidence dates, or rights states.

Every official catalogue record also has one versioned source-access recipe. The recipe either
defines a bounded, source-specific request or records why only manual guidance is currently safe.
Generated recipe and provider-resource JSON are projected into the catalogue, four REST routes,
both SDKs and four read-only MCP tools. All of those views carry the same recipe hash and
limitations. They do not execute the
request; network use is confined to explicit local CLI commands and individually enabled runtime
connections.

Metadata-only verification evidence is separate from source data. It records a bounded check's
time, outcome, response size, hashes, media type and record count, and expires automatically. The
repository does not retain the checked response body. A working check is technical evidence only,
not provider authorization or a promise of continued availability.

## Publication guarantees

A release candidate must demonstrate:

- schema-valid, deterministically regenerated catalogue artifacts;
- a complete source-access registry with deterministic examples, fixtures and status documentation;
- drift-free generated counts and README statistics;
- unit, type, build, browser, accessibility, and no-provider-traffic checks;
- runtime unit and contract tests for any included runtime component;
- Docker checks proving that external data connections are off by default;
- a public-boundary and secret scan;
- a release evidence record tied to the tested commit.

Passing local tests is necessary but does not prove that a public deployment is secure, that a
provider permits the intended use, or that an independent reviewer has accepted the release.

## Rights and representation

The Apache-2.0 licence applies to project-authored material. It does not relicense third-party data,
APIs, names, marks, documentation, or services. Catalogue inclusion and terms-review labels are not
endorsements or legal opinions. Current provider terms, dataset-specific conditions, technical
controls, and applicable law control every actual use, including commercial use, caching,
redistribution, scraping, attribution, and personal-data processing.

Corrections and takedowns follow a documented, evidence-backed process. Security reports use a
private channel so credentials, vulnerabilities, and sensitive data are not exposed in public
issues.
