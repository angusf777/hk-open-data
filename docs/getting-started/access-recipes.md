# Use a Hong Kong public-data source

[繁體中文版](access-recipes.zh-HK.md)

The source-access toolkit turns reviewed source documentation into bounded, versioned recipes.
Each recipe identifies the official documentation, authentication requirements, request template,
allowed host, parameters, response type, limitations, and ready-to-copy examples. You can inspect
all of that locally before deciding whether to contact a listed source.

The current registry covers all 265 official sources in the catalogue: 227 executable recipes with
synthetic test fixtures and 38 entries with source-specific manual guidance. Of the executable
recipes, 190 contain 356 reviewed source-to-dataset mappings across 350 unique DATA.GOV.HK dataset
identifiers; the other 37 contact a documented data endpoint directly.

On 4 September 2026, all 350 mapped DATA.GOV.HK package records resolved successfully to 5,862
provider resources. The safe inventory classified 5,391 as parameter-free HTTPS, 6 as HTTPS
templates that require parameters, and 465 as HTTP-only. A separate bounded payload run received a
non-empty 2xx response for a representative direct file or API from 234 datasets. Five datasets
returned a current provider failure and 111 had no parameter-free direct HTTPS payload candidate.
Landing pages and geoportals are deliberately not counted as payload proof. See the
[exact exceptions and method](../access/provider-resources.md). Live evidence expires and never
guarantees later availability.

The 145 external resources and 111 community MCP projects are catalogue candidates rather than
source recipes. The current link pass reached or safely redirected 128 external landing pages and
107 MCP repository links, but it did not authenticate to those APIs or execute third-party MCP
software. See the [coverage and evidence matrix](../access/coverage.md).

## Install the development workspace

Requirements are Python 3.12+ and [uv](https://docs.astral.sh/uv/).

```bash
git clone https://github.com/angusf777/hk-open-data.git
cd hk-open-data
uv sync --frozen --all-packages --all-groups
```

The commands below use the project-local environment, so they do not install a global package.
Run them inside the checkout. If you invoke the installed `hkdata` entry point from elsewhere, set
`HK_OPEN_DATA_REPOSITORY=/absolute/path/to/hk-open-data`; the CLI also discovers its checkout when
installed in editable development mode.

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
reviewed dataset identifiers. The generated
[`data-gov-resources.json`](../../access/generated/data-gov-resources.json) inventory then records
each resource ID, exact provider URL or template, format, required parameter names, mapped
catalogue sources and access classification. It contains provider metadata—not copied datasets.

For a visual workflow, open the public
[provider-resource browser](https://angusf777.github.io/hk-open-data/provider-resources/). It
searches the same inventory, distinguishes provider pages from direct files and APIs, and generates
cURL, Python, Node or `hkdata` usage only for exact direct resources with current bounded payload
evidence. Filters are preserved in the URL; add `?q=HKAPI-030` to scope the page to a catalogue
source. Running a generated command remains a separate, explicit action.

For zero-install analysis, download JSON, CSV, or SQLite metadata snapshots from the same page.
They contain catalogue metadata, URLs, and technical evidence—not provider dataset payloads.

List the current provider resources for one catalogue source without using the network:

```bash
uv run --project packages/sdk-python hkdata resources HKAPI-030
uv run --project packages/sdk-python hkdata resources HKAPI-030 \
  --dataset nlb-bus-nlb-bus-service-v2
```

Generate copyable cURL, Python or TypeScript for one resource. Required values are substituted and
URL-encoded only after all parameter names pass the resource template's allowlist:

```bash
uv run --project packages/sdk-python hkdata resource-example HKAPI-030 \
  6a3b194a-4718-44aa-9087-34ac2f7117ff curl \
  --dataset nlb-bus-nlb-bus-service-v2 --param routeId=1
```

The result is a direct provider request:

```bash
curl --fail-with-body --location --max-time 30 --max-filesize 26214400 \
  --output resource.data \
  'https://rt.data.gov.hk/v2/transport/nlb/stop.php?action=list&routeId=1'
```

To download through the guarded CLI, choose the destination and size limit explicitly. The command
uses exclusive file creation and refuses to overwrite an existing file:

```bash
uv run --project packages/sdk-python hkdata fetch-resource HKAPI-030 \
  96c5e827-3d3a-4110-8cd2-e7c80cd562bc \
  --dataset nlb-bus-nlb-bus-service-v2 --max-bytes 1048576 \
  --output nlb-routes.json
```

This exact command was rerun on 3 September 2026 and returned HTTP 200, 64 NLB routes and 18,797
bytes. The following commands prove both parameterized URL paths through the same guarded CLI:

```bash
uv run --project packages/sdk-python hkdata fetch-resource HKAPI-030 \
  6a3b194a-4718-44aa-9087-34ac2f7117ff \
  --dataset nlb-bus-nlb-bus-service-v2 --param routeId=1 \
  --max-bytes 1048576 --output nlb-stops.json

uv run --project packages/sdk-python hkdata fetch-resource HKAPI-030 \
  690662ca-748a-4dc0-89c1-b3aaf280d06a \
  --dataset nlb-bus-nlb-bus-service-v2 \
  --param routeId=1 --param stopId=1 --param languageCode=en \
  --max-bytes 1048576 --output nlb-eta.json
```

The check completed at 2026-09-03T04:00:42Z with these observations:

| Request | HTTP | Bytes | Parsed records | Response SHA-256 |
| --- | ---: | ---: | ---: | --- |
| Routes | 200 | 18,797 | 64 routes | `44369c71003e8ac47f3970be2ce9f84535629fee90631bc0b9e4c94e9307c590` |
| Stops for `routeId=1` | 200 | 20,259 | 56 stops | `8e10f16ad787fe3a7344791391136cd907ac69d1359606b6cf2c58ec3771c51b` |
| ETA for route 1, stop 1 | 200 | 427 | 1 ETA | `37312e81e13c0648899e0ca7b550ede1192594fd9c939dec93dfe25bff58d4d7` |

The hashes and record counts are point-in-time evidence and will change as the provider updates the
feeds; they are not permanent availability or content guarantees. The downloaded bodies were
deleted after the check.

The other parameterized provider URLs were checked with values from their official data
dictionaries:

| Source | Required example | 3 September 2026 observation |
| --- | --- | --- |
| HKAPI-076, airport history | `--param date=2026-09-02` (use the previous calendar day in `YYYY-MM-DD`) | HTTP 200; 82,810 bytes; 414 flight records; SHA-256 `efd0f1fbf9a28cedc6da773f691290cf5048d485253aa9d2cdbc1e942623a343` |
| HKAPI-044, Sun Ferry | `--param routecode=CEMW` (Central to Mui Wo) | HTTP 200; 379 bytes; 1 ETA; SHA-256 `7aba513f6fa8af32717099bee61241e143a4dcf3c5eb369e4389b5eb57380343` |
| HKAPI-043, Water Taxi | `--param route_code=WATERTAXI` | HTTP 403 from this host; correct documented parameter, but no current automated-access claim |
| HKAPI-042, Fortune Ferry | `--param route_code=HHTEC` (Hung Hom to Tsim Sha Tsui East) | HTTP 403 from this host; correct documented parameter, but no current automated-access claim |

Use the relevant resource ID from `hkdata resources SOURCE` before the flag above. The airport
[data specification](https://www.hongkongairport.com/iwov-resources/misc/opendata/Flight_Information_DataSpec_en.pdf),
Sun Ferry [ETA specification](https://www.sunferry.com.hk/eta/SunFerry_ETA_API_Specification_and_Data_Dictionary.pdf),
and Water Taxi [data dictionary](https://www.hongkongwatertaxi.com.hk/csv/DataDictionary.pdf)
remain authoritative for valid parameter values. The 403 responses were preserved as failures;
the toolkit does not bypass provider access controls.

For a catalogue entry that represents several datasets, inspect the recipe's `id` parameter
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

Refresh the provider-resource inventory and rerun representative payload evidence only when you
intend to contact the providers. Concurrency is capped at three; payload samples are capped at 4
KiB by default and are hashed but not retained:

```bash
uv run python -m scripts.data_gov_resources refresh --concurrency 3
uv run python -m scripts.data_gov_resources probe --concurrency 3 \
  --sample-bytes 4096 --max-candidates 3
uv run python -m scripts.data_gov_resources check
```

`check` verifies that the inventory still matches all reviewed dataset mappings, that the probe
evidence matches the exact inventory hash, and that the generated exception report has not drifted.

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
GET /v1/access-resources?source_reference=HKAPI-030
GET /v1/access-resources/{dataset_id}/{resource_id}
```

List filters include `adapter`, `status`, `authentication`, `verification_freshness`, `cursor` and
`limit`. The detail response includes all three examples and the metadata-only verification
summary. See the [runtime guide](runtime.md) before starting the service.

Python SDK methods:

```python
recipe = client.get_access_recipe("HKAPI-001")
page = client.list_access_recipes(status="live-verified")
example = client.get_access_example("HKAPI-001", "python")
resources = client.list_access_resources(source_reference="HKAPI-030", limit=10)
resource = client.get_access_resource(
    "nlb-bus-nlb-bus-service-v2",
    "96c5e827-3d3a-4110-8cd2-e7c80cd562bc",
)
```

TypeScript SDK methods:

```typescript
const recipe = await client.getAccessRecipe("HKAPI-001");
const page = await client.listAccessRecipes({ status: "live-verified" });
const example = await client.getAccessExample("HKAPI-001", "typescript");
const resources = await client.listAccessResources({ source_reference: "HKAPI-030", limit: 10 });
const resource = await client.getAccessResource(
  "nlb-bus-nlb-bus-service-v2",
  "96c5e827-3d3a-4110-8cd2-e7c80cd562bc",
);
```

The read-only MCP server provides `access_recipes_list`, `access_recipe_get`,
`access_resources_list` and `access_resource_get`. They read the four REST routes above and do not
execute a source, accept an arbitrary URL, or return source response bodies. The resource tools
make exact URLs and required parameters available to MCP clients while leaving network execution
as a separate, deliberate action.

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
