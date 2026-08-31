# Catalogue field reference

Each YAML file under `catalog/official`, `catalog/external`, or `catalog/mcp` represents one public
metadata record. [`catalog/schemas/resource.schema.json`](../../catalog/schemas/resource.schema.json)
is the machine-enforced contract; this page explains its meaning.

| Field | Meaning |
| --- | --- |
| `schemaVersion` | Record contract version. Currently `1`. |
| `id` | Stable namespaced ID: `official:*`, `external:*`, or `mcp:*`. |
| `sourceReference` | Traceable reference retained from source research. It is not a provider ID unless stated by that provider. |
| `type` | Catalogue collection: `official`, `external`, or `mcp`. |
| `publicationStatus` | `published`, `draft`, or `archived`; only published records belong in the public aggregate. |
| `name`, `summary` | Required English and Traditional Chinese display text. |
| `translationStatus` | `seeded` means no human language review is recorded; `reviewed` means a human review was recorded by the project. It does not certify an official translation. |
| `provider` | Bilingual provider name and broad provider type. Provider names and marks remain upstream material. |
| `categories`, `tags` | Controlled discovery labels; these are project metadata rather than provider classifications unless a record says otherwise. |
| `protocols`, `formats` | Observed or documented technical interfaces and response forms. |
| `authentication` | Reported access mechanism, including `unknown` and `not-applicable`. |
| `access` | Broad access route such as endpoint, registration, credential, repository, or download. |
| `urls` | HTTPS landing, documentation, and terms links; nullable where no authoritative link was recorded. |
| `languages` | Languages observed or documented for the resource. |
| `availability`, `updateCadence` | Optional factual notes, not guarantees. |
| `verification` | Project review state, date, and supporting URL. |
| `termsEvidence` | Dated rights/terms research with a state, note, attribution, and explicit restrictions. It is not legal advice or permission. |
| `integrations` | Whether a connector, SDK, or MCP integration is absent, a candidate, planned, available, or deprecated in this project. |

## Verification states

- `candidate`: discovered but not substantively reviewed.
- `metadata-reviewed`: descriptive metadata was reviewed against the cited source.
- `link-verified`: a cited HTTPS page was reachable when checked.
- `source-reviewed`: the relevant authoritative material received a project review.
- `stale`: the recorded review is older than the project threshold or known to need rechecking.
- `unavailable`: the cited source was unavailable when checked.

These states describe catalogue work, not endpoint health, security, suitability, endorsement, or
production authorization.

## Terms-evidence states

- `not-reviewed`: no current project review of provider terms is recorded.
- `official-terms-linked`: an authoritative terms page is linked without a project conclusion.
- `restriction-identified`: an explicit relevant restriction is recorded and linked.
- `ambiguity-identified`: available material leaves a material question unresolved.
- `provider-confirmation-recorded`: a dated, attributable provider statement is recorded; its exact
  scope and wording still control.

None of these labels determines whether commercial use, caching, redistribution, scraping,
attribution, or personal-data processing is lawful or permitted. Always recheck current upstream
material for the actual intended use.
