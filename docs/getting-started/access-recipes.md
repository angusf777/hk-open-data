# Use a Hong Kong public-data source

[繁體中文版](access-recipes.zh-HK.md)

The source-access toolkit turns reviewed source documentation into bounded, versioned recipes.
Each recipe identifies the official documentation, authentication requirements, request template,
allowed host, parameters, response type, limitations, and ready-to-copy examples. You can inspect
all of that locally before deciding whether to contact a listed source.

The current registry covers all 265 official sources in the catalogue: 227 executable recipes with
synthetic test fixtures and 38 entries with source-specific manual guidance. Of the executable
recipes, 190 contain 356 reviewed source-to-dataset mappings across 350 unique DATA.GOV.HK dataset
identifiers and resolve them to their current resource URLs;
the other 37 contact a documented data endpoint directly. A bounded check on 1 September 2026
recorded successful live verification for all 350 mapped dataset identifiers, all 190 resource
index defaults, and 29 direct-response recipes.
The eight other direct-response recipes retain fixture evidence and a recorded live failure. Live
evidence expires and never guarantees later availability.

The 145 external resources and 111 community MCP projects are catalogue candidates rather than
source recipes. The current link pass reached or safely redirected 128 external landing pages and
107 MCP repository links, but it did not authenticate to those APIs or execute third-party MCP
software. See the [coverage and evidence matrix](../access/coverage.md).

## Install the development workspace

Requirements are Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/angusf777/hk-open-data.git
cd hk-open-data
uv sync --frozen --all-groups
```

The commands below use the project-local environment, so they do not install a global package.

## Inspect a recipe without using the network

```bash
uv run --project packages/sdk-python hkdata recipe HKAPI-001
uv run --project packages/sdk-python hkdata recipe HKAPI-001 --format yaml
uv run --project packages/sdk-python hkdata example HKAPI-001 python
```

In short, the corresponding commands are `hkdata recipe HKAPI-001` and
`hkdata example HKAPI-001 python`. Recipe and example lookup reads repository files only. Generated
curl, Python and TypeScript examples are also available under `access/generated/examples/`.

For a `manual-only` entry, the recipe explains why a safe machine request is not published and
gives the next documentation step. The project does not invent an endpoint when the available
source material identifies only a search page, interactive form, account workflow, or
dataset-specific choice.

### DATA.GOV.HK resource indexes

`data-gov-resource-index` recipes call the official CKAN `package_show` action with one or more
reviewed dataset identifiers. The response contains current resource names, formats and URLs. It
does **not** mean that every linked file or downstream API was downloaded, parsed, licensed, or
live-tested. For a catalogue entry that represents several datasets, inspect the `id` parameter's
`enum` and select a reviewed identifier explicitly:

```bash
uv run --project packages/sdk-python hkdata recipe HKAPI-174
uv run --project packages/sdk-python hkdata fetch HKAPI-174 \
  --param id=hk-reo-reopsi01-election-result-lc-2025lcge --output json
```

## Make one explicit bounded request

`fetch` and `verify` are the commands that can contact a listed source. Review the recipe and the
source's current terms before running either command.

```bash
uv run --project packages/sdk-python hkdata fetch HKAPI-001 --output json
uv run --project packages/sdk-python hkdata fetch HKAPI-001 --param limit=5 --output ndjson
```

A `live-verified` recipe can be fetched directly while its matching evidence is current. To run a
recipe that has only synthetic fixture evidence, acknowledge that boundary explicitly:

```bash
uv run --project packages/sdk-python hkdata fetch HKAPI-018 --allow-unverified
```

Parameters are allowlisted and type-checked. Requests use HTTPS, an exact host allowlist, bounded
timeouts, response-size limits, retry limits, and no automatic cross-host redirect. Response data
is written to stdout; request diagnostics are written to stderr.

## Verify technical compatibility

Verify one anonymous recipe:

```bash
uv run --project packages/sdk-python hkdata verify HKAPI-001
```

The short command is `hkdata verify HKAPI-001`. To check all anonymous executable recipes, opt in
explicitly; sequential execution is the default and concurrency cannot exceed three:

```bash
uv run --project packages/sdk-python hkdata verify --all-anonymous
uv run --project packages/sdk-python hkdata verify --all-anonymous --concurrency 3
```

Verification writes one metadata-only JSON file per attempted source under `access/verification/`.
It records timestamps, hashes, media type, size, record count, stable error code and limitations.
It does not retain the response body, authorization headers, cookies or credentials. A successful
record must match the current recipe hash and remain within `validUntil` before the generated
status can be `live-verified`.

Stable non-zero exit codes are: `2` invalid input or unknown recipe, `3` authentication required,
`4` source unavailable, `5` response media or schema mismatch, `6` recipe not executable, and `7`
unsafe redirect or oversized response.

## Understand the status labels

| Status | Meaning |
| --- | --- |
| `live-verified` | A current, matching, successful metadata-only check exists |
| `fixture-tested` | Planning and parsing pass a hashed synthetic fixture; current live success is absent |
| `credential-required` | The documented request needs credentials supplied through named environment variables |
| `manual-only` | Documentation is useful, but a safe executable request has not been established |
| `blocked` | A recorded prerequisite prevents execution |
| `unavailable` | A formerly documented request is retained with a recovery step but is not currently usable |

The generated [official-source status index](../access/source-status.md) gives the current effective
status and latest verification outcome for every official source.

## Read recipes through the local API or SDKs

The self-hosted REST service exposes repository data only; these routes do not execute a source:

```text
GET /v1/access-recipes
GET /v1/access-recipes/{source_reference}
```

List filters include `adapter`, `status`, `authentication`, `verification_freshness`, `cursor` and
`limit`. The detail response includes all three examples and the metadata-only verification
summary. See the [runtime guide](runtime.md) before starting the service.

Python SDK methods:

```python
recipe = client.get_access_recipe("HKAPI-001")
page = client.list_access_recipes(status="live-verified")
example = client.get_access_example("HKAPI-001", "python")
```

TypeScript SDK methods:

```typescript
const recipe = await client.getAccessRecipe("HKAPI-001");
const page = await client.listAccessRecipes({ status: "live-verified" });
const example = await client.getAccessExample("HKAPI-001", "typescript");
```

The read-only MCP server provides `access_recipes_list` and `access_recipe_get`. They read the two
REST routes above and do not execute a source, accept an arbitrary URL, or return source response
bodies.

## Add or correct one source

1. Update the source record under `catalog/official/` and its matching
   `access/recipes/official/hkapi-NNN.yml`.
2. Cite the official documentation. If it does not establish a safe exact request, keep the recipe
   `manual-only` and write a concrete reason and next action.
3. For an executable recipe, add synthetic request and response fixtures and update both fixture
   manifests.
4. Run `pnpm access:generate`, `pnpm catalog:generate`, `uv run pytest tests/access -q`,
   `pnpm access:check`, and `pnpm catalog:check`.
5. Run live verification only when you deliberately choose to contact the source. Never commit a
   source response body or credential.

## Permission and accuracy boundary

This toolkit provides technical instructions, not provider authorization or legal advice.
Inclusion, a generated example, fixture success, or live technical success does not grant
permission for commercial use, caching, redistribution, scraping, personal-data processing, or
any other proposed activity. Review the provider's current platform-wide and dataset-specific
terms, licences, attribution rules, technical controls and applicable law before use. The original
source remains authoritative.
