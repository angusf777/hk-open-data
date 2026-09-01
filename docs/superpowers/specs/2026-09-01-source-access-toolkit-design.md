# Source Access Toolkit Design

**Status:** Approved design awaiting implementation planning
**Date:** 2026-09-01
**Repository:** `angusf777/hk-open-data`

## 1. Purpose

HK Open Data must make documented public-data interfaces practical to use. For every official
catalogue record, the project will either provide executable, tested access instructions or state
precisely why automated access is not currently available. A documentation link or reachable
landing page is not sufficient evidence that a connector works.

The toolkit will add a versioned source-access recipe registry, reusable protocol adapters,
generated examples, a local command-line interface, verification evidence, and consistent
catalogue, REST, SDK, and MCP projections.

## 2. Product boundary

The GitHub Pages catalogue remains a static discovery site. Loading, searching, filtering, and
viewing a resource will not contact a provider.

Provider requests occur only when an operator explicitly:

- runs `hkdata fetch` or `hkdata verify`; or
- enables a reviewed connector or health check in the self-hosted runtime.

The project does not operate a hosted data API, proxy provider traffic, supply credentials, bypass
access controls, or grant permission to use a source. Provider responses are not committed to Git.

## 3. Scope

### 3.1 Initial delivery

The implementation will cover all 265 published official records:

- every record receives an explicit access classification;
- every source with documented machine access receives a validated source-specific recipe;
- anonymous endpoints are eligible for bounded live verification;
- credentialed, registration-only, session-based, manual, blocked, and unavailable sources retain
  explicit non-live statuses and setup guidance.

The 22 existing `HKAPI-*` runtime sources are the first compatibility wave. Their current ten
source-group parsers will be replaced or wrapped by source-specific recipes rather than treated as
proof that every endpoint in a group has one response shape.

### 3.2 Later coverage

The 145 external services may receive recipes after the official-source milestone. Credential and
provider-policy requirements remain source-specific. The 111 MCP candidates are evaluated as
software integrations and are not counted as provider data connectors.

## 4. Delivery decomposition

The work is divided into four independently testable releases:

1. Recipe foundation: schema, validation, generated index and examples, adapters, and CLI.
2. Existing runtime sources: source-specific recipes and live compatibility evidence for the 22
   current `HKAPI-*` definitions where anonymous access is available.
3. Official catalogue coverage: classification and recipes for the remaining official records.
4. Product integration: catalogue access panel, REST and SDK projections, and two read-only MCP
   recipe tools.

Each release must leave the repository truthful and usable on its own. Coverage counts are derived
from generated artifacts, never maintained by hand.

## 5. Architecture

```text
catalogue YAML
     | sourceReference
     v
access recipe YAML -- validate --> generated recipe index and examples
     |                                  |       |       |       |
     v                                  v       v       v       v
protocol adapter                    catalogue  CLI   REST/SDK  MCP
     |
     v
SafeFetcher --> provider --> parser --> normalized records + verification evidence
```

The recipe is the single source of truth for forming a request. Adapters implement reusable
protocol behavior. Source-specific differences remain declarative in recipes unless a documented
format requires a focused parser.

## 6. Repository structure

The implementation will use these ownership boundaries:

- `access/schemas/access-recipe.schema.json`: public recipe contract.
- `access/recipes/official/*.yml`: one recipe per official `sourceReference` when machine access is
  documented; non-executable classifications may use a recipe with `request: null`.
- `access/verification/*.json`: metadata-only verification records.
- `access/generated/recipes.json`: deterministic public recipe index.
- `access/generated/examples/`: deterministic curl, Python, and TypeScript examples.
- `services/worker/hk_data_worker/adapters/`: reusable request and parse adapters.
- `packages/sdk-python/src/hk_data_sdk/cli.py`: the `hkdata` command.
- `scripts/access.py`: validation and deterministic generation entry point.

Existing catalogue generation will consume `access/generated/recipes.json` and join by
`sourceReference`. The API will seed the same generated artifact. No catalogue YAML record will
duplicate executable request details.

## 7. Access recipe contract

Every recipe uses `schemaVersion: 1` and contains the following fields.

### 7.1 Identity and classification

- `sourceReference`: exact catalogue reference.
- `adapter`: one supported adapter identifier or `none`.
- `status`: one status from Section 8.
- `documentationUrl`: authoritative HTTPS interface documentation.
- `limitations`: concise user-facing limitations.

The validator requires exactly one recipe for every published official catalogue record and exactly
one published official catalogue record for every recipe reference. Duplicate, missing, and orphan
recipes fail generation.

### 7.2 Request definition

Executable recipes contain:

- `method`: `GET`, `POST`, or `HEAD` where the official interface requires it.
- `urlTemplate`: exact HTTPS endpoint template.
- `allowedHosts`: explicit host allowlist, including separately documented redirect hosts.
- `parameters`: name, location, data type, required flag, default, safe example, and description.
- `headers`: fixed public headers or environment-variable references; never credential values.
- `bodyTemplate`: structured JSON or form template for documented POST interfaces.
- `timeoutMs`: integer from 1,000 through 60,000.
- `maxResponseBytes`: positive integer no greater than 25 MiB by default.
- `maxPages`: integer from 1 through 100.
- `retry`: maximum attempts from 1 through 3 and eligible status codes.

Sensitive parameters must reference environment-variable names matching
`^[A-Z][A-Z0-9_]{2,127}$`. Values are never stored in recipes, generated artifacts, logs, evidence,
or examples.

Non-executable classifications use `request: null` and must provide a reason and next action.

### 7.3 Response definition

Executable recipes contain:

- `mediaTypes`: allowed response media types.
- `recordPath`: JSON Pointer, XPath subset, CSV row, feed item, feature, or whole-document selector.
- `idPath`: optional provider identifier selector.
- `timestampPath`: optional provider timestamp selector.
- `pagination`: none, offset, cursor, next-link, page-number, or provider-specific bounded strategy.
- `normalization`: field mappings plus language, geometry, and timestamp rules.

The parser retains source fields as inert data, calculates a stable normalized record hash, and
associates every record with the source reference, recipe version, response hash, retrieval time,
and lineage identifiers. Provider text cannot modify a planned request.

### 7.4 Generated examples

Examples are generated rather than hand-authored. Each executable recipe produces:

- a shell-safe curl example;
- a Python example using `httpx` or the project SDK;
- a TypeScript example using `fetch` or the project SDK.

Examples use bounded parameters and credential placeholders. Generated code must parse or typecheck
in CI and must form the same URL, headers, and body as the recipe executor.

## 8. Status model

Each recipe has exactly one persisted status:

- `live-verified`: a bounded request and recipe parse succeeded within the evidence validity window.
- `fixture-tested`: offline contract tests pass, but no current successful live result is recorded.
- `credential-required`: documented machine access exists but required credentials are unavailable.
- `manual-only`: the authoritative source provides no documented machine interface.
- `blocked`: automation is deliberately withheld because of a documented policy, access-control,
  safety, or unresolved endpoint issue.
- `unavailable`: the authoritative interface is currently unreachable or removed.

Live evidence includes `checkedAt` and `validUntil`. Once `validUntil` passes, public projections
must not describe the recipe as currently live-verified; they show its fixture-tested capability
and stale live-evidence limitation until verification succeeds again.

Status rules are enforced mechanically:

- `live-verified` requires successful, unexpired evidence matching the recipe hash.
- `fixture-tested` requires passing adapter and recipe fixtures.
- `credential-required` requires an executable request and authentication setup instructions.
- `manual-only` and `blocked` require `request: null`.
- `unavailable` retains its last authoritative request definition so `verify` can test recovery,
  while ordinary `fetch` remains disabled.
- no catalogue integration may be marked `available` without a validated executable recipe.

Technical status remains separate from catalogue terms-review state. Neither status grants rights.

## 9. Adapter contract

The initial adapter registry contains:

- `ckan-action`
- `rest-json`
- `odata`
- `arcgis-rest`
- `ogc-wfs`
- `ogc-wms`
- `xml`
- `csv`
- `rss`
- `file-download`

Each adapter implements two interfaces:

```python
def plan(recipe: AccessRecipe, parameters: dict[str, object]) -> tuple[ApprovedRequest, ...]: ...
def parse(
    recipe: AccessRecipe,
    raw: RawObjectRef,
    response: FetchResult,
) -> tuple[SourceRecordDraft, ...]: ...
```

`plan` validates required parameters, expands only declared placeholders, and emits requests whose
hosts are present in `allowedHosts`. `parse` validates media type and declared response shape before
returning records. A mismatch quarantines the run and publishes no partial normalized output.

The existing `SafeFetcher` remains the only network implementation. Adapters may not instantiate
their own HTTP clients.

## 10. Command-line interface

The Python SDK package will install `hkdata` with these commands:

```text
hkdata recipe SOURCE_REFERENCE [--format json|yaml]
hkdata example SOURCE_REFERENCE --language curl|python|typescript
hkdata fetch SOURCE_REFERENCE [--param NAME=VALUE]... [--output json|ndjson]
hkdata verify SOURCE_REFERENCE
hkdata verify --all-anonymous --concurrency 1
```

Behavior:

- `recipe` and `example` are offline.
- `fetch` performs one explicit, bounded execution and writes normalized data to stdout.
- diagnostics and evidence summaries go to stderr.
- `fetch` does not persist response bodies.
- a fixture-tested recipe requires `--allow-unverified`; blocked and manual recipes cannot be
  overridden, and unavailable recipes can be retried only through `verify`.
- missing credential environment variables fail before network access.
- `verify --all-anonymous` defaults to sequential execution and supports a maximum concurrency of
  three when explicitly requested.

Exit codes are stable: `0` success, `2` invalid input, `3` authentication required, `4` source
unavailable, `5` schema mismatch, `6` blocked by policy, and `7` unsafe response or redirect.

## 11. Live verification evidence

Live verification is allowed only for anonymously accessible official endpoints. It uses safe
examples, minimum practical result limits, bounded timeouts, and declared rate limits.

Each verification record contains:

- recipe reference, version, and SHA-256;
- checked and validity timestamps;
- outcome and stable error code;
- final allowlisted host, HTTP status, elapsed milliseconds, and media type;
- response byte count and SHA-256;
- structural schema fingerprint;
- parsed record count;
- limitations and tool version.

Verification records never contain response bodies, credentials, authorization headers, cookies,
personal data, or provider text. Evidence generation writes to a temporary file and replaces the
target atomically only after validation.

Live verification does not attempt login, registration, CAPTCHA, WAF bypass, scraping of
undocumented pages, bulk mirroring, or speculative URL discovery.

## 12. REST and SDK interfaces

The self-hosted API adds:

- `GET /v1/access-recipes`
- `GET /v1/access-recipes/{source_reference}`

List filters include adapter, status, authentication, and verification freshness. Public responses
contain the recipe, generated examples, verification summary, and limitations but no credential
values or private review notes.

Python and TypeScript SDKs add:

- `listAccessRecipes(query)`
- `getAccessRecipe(sourceReference)`
- `getAccessExample(sourceReference, language)`

The public API does not add a remote provider-fetch endpoint. Existing normalized record endpoints
remain the supported remote data surface after an operator enables collection.

## 13. MCP interface

The read-only MCP contract adds:

- `access_recipes_list`: list visible recipes with adapter, status, authentication, freshness, and
  limitations.
- `access_recipe_get`: return one recipe and its generated examples.

Both tools read platform state only. They cannot contact providers, reveal credentials, enable
connectors, execute arbitrary URLs, or return raw provider bodies. The MCP contract version and
fingerprint must be bumped intentionally, and the exact resulting tool list must be tested.

## 14. Catalogue experience

Official resource detail pages gain an Access section showing:

- current connector and verification status;
- adapter and authentication requirements;
- last successful live check and evidence freshness;
- exact parameters and response formats;
- copyable curl, Python, and TypeScript examples;
- known limitations and authoritative documentation.

Status language must distinguish documented, fixture-tested, live-verified, gated, and unavailable
sources. The static site reads generated recipe data only and never executes examples or contacts
providers.

Catalogue filters add `Has executable recipe`, `Live verified`, and `No automated access` without
changing the existing resource-type semantics.

## 15. Error model

Recipe validation and execution use these stable codes:

- `RECIPE_NOT_FOUND`
- `RECIPE_NOT_EXECUTABLE`
- `INVALID_PARAMETER`
- `AUTH_REQUIRED`
- `SOURCE_UNAVAILABLE`
- `SCHEMA_MISMATCH`
- `MEDIA_TYPE_MISMATCH`
- `UNSAFE_REDIRECT`
- `RESPONSE_TOO_LARGE`
- `PAGE_LIMIT_EXCEEDED`
- `RATE_LIMITED`
- `PROVIDER_ACCESS_DISABLED`

Errors contain a safe message, retryability, source reference, recipe version, and correlation ID.
They never contain secrets, raw authorization material, response bodies, or stack traces.

## 16. Testing strategy

Implementation follows red-green-refactor cycles.

### 16.1 Schema and generator tests

Tests cover valid recipes, every status, missing required fields, orphan references, duplicate
references, non-HTTPS URLs, undeclared hosts, credential values, unsafe templates, contradictory
statuses, deterministic generation, and example syntax.

### 16.2 Adapter contract tests

Each adapter has authored fixtures for success, empty success, pagination, malformed payload,
unexpected media type, missing identifiers, provider timestamps, hostile prompt-like text,
redirects, retries, page limits, and response limits.

Fixtures remain clearly synthetic unless an upstream licence and repository policy explicitly
permit redistribution. Fixture provenance and hashes remain mandatory.

### 16.3 Execution tests

Integration tests prove approval checks, raw-before-parse ordering in fabric mode, digest-only
behavior in observe mode, no network in catalogue mode, no partial publication after quarantine,
stable record IDs, evidence atomics, and consistent CLI/API/SDK/MCP recipe versions.

### 16.4 Live smoke tests

Live smoke tests are opt-in, low-volume, sequential by default, and restricted to anonymous
official endpoints. A source earns `live-verified` only when request formation, network response,
media validation, parsing, and normalization all succeed for the committed recipe.

## 17. Migration and compatibility

Existing catalogue records keep schema version 1. The access registry is joined by
`sourceReference`, so recipe rollout does not require rewriting descriptive metadata fields.

The `integrations.connector` field becomes generated from recipe state during catalogue build:

- executable, valid recipes publish `available`;
- classified future work publishes `planned`;
- all other states publish `none` unless deprecated.

The first migration creates recipes for the 22 current `HKAPI-*` sources and updates current
workers to dispatch by recipe instead of assuming one response shape for an entire source group.
Old group identifiers remain as reporting labels during the migration but no longer determine the
parser alone.

## 18. Security and operational controls

- Only HTTPS endpoints are executable.
- Hosts, redirects, parameters, methods, media types, body size, pages, retries, and timeouts are
  allowlisted and bounded by recipes.
- DNS and redirect targets are revalidated by `SafeFetcher`.
- Credentials are read at execution time from named environment variables.
- Logs and evidence are secret-scanned and omit provider bodies.
- Catalogue and MCP views cannot trigger network access.
- Provider access remains disabled in the default Compose profile.
- Runtime kill switches continue to invalidate active leases.

## 19. Acceptance criteria

The official-source milestone is complete only when:

1. All 265 official records have an explicit access classification.
2. Every documented machine interface has a schema-valid recipe or a recorded, evidence-backed
   blocker.
3. Every executable recipe produces syntactically valid curl, Python, and TypeScript examples.
4. Every `live-verified` recipe has unexpired evidence matching its current recipe hash.
5. The 22 current runtime sources no longer rely solely on broad synthetic source-group fixtures.
6. CLI, catalogue, REST, SDK, and MCP projections agree on recipe version and status.
7. No default command or static-site action contacts a provider.
8. `make verify-all`, integrated Docker checks, secret scanning, public-boundary checks, CodeQL, and
   protected-branch CI pass for the published revision.
9. Release evidence reports exact counts for live-verified, fixture-tested, credential-required,
   manual-only, blocked, unavailable, and unclassified records; unclassified must be zero.

## 20. Public claims

Until the acceptance criteria pass, public documentation will call the runtime a connector
framework with selected reference implementations. After acceptance, it may state that every
official catalogue record has actionable access guidance and that live-verified sources include
tested executable recipes.

The project will never describe catalogue inclusion, a successful request, or technical
compatibility as provider authorization, endorsement, commercial-use permission, caching rights,
or redistribution rights.
