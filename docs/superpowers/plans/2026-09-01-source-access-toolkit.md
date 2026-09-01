# Source Access Toolkit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every published official catalogue resource actionable, truthful access guidance and provide safe executable recipes through the local CLI, worker runtime, REST API, SDKs, catalogue, and read-only MCP server.

**Architecture:** Versioned YAML recipes are the only source of truth for provider request formation. Python adapters plan bounded requests through the existing `SafeFetcher`, parse declared response shapes, and emit normalized records or metadata-only verification evidence; deterministic generated JSON and examples feed all public projections without provider traffic.

**Tech Stack:** Python 3.12, Pydantic 2, httpx, PyYAML, jsonschema, pytest, respx, Node.js 22, TypeScript 7, Zod 4, Fastify 5, React 19, Vitest 4, MCP TypeScript SDK 2, pnpm 10, uv, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-01-source-access-toolkit-design.md`

## Global Constraints

- Cover all 265 published official records, `HKAPI-001` through `HKAPI-265`, with exactly one recipe and no orphan recipes.
- Keep `schemaVersion: 1` for both catalogue records and access recipes.
- Provider traffic occurs only after an explicit `hkdata fetch`, `hkdata verify`, or an enabled self-hosted runtime action.
- Accept only HTTPS provider destinations and credential-free URL templates.
- Allowlist method, initial host, redirect hosts, parameters, headers, media types, timeouts, retries, response bytes, and page counts in each executable recipe.
- Bound `timeoutMs` to 1,000–60,000, `maxPages` to 1–100, retry attempts to 1–3, and default `maxResponseBytes` to at most 25 MiB.
- Read credentials only from environment-variable names matching `^[A-Z][A-Z0-9_]{2,127}$`; never store credential values.
- Never commit provider response bodies, credentials, authorization headers, cookies, personal data, or provider text as live evidence.
- Keep the GitHub Pages catalogue fully static; catalogue interaction and MCP recipe reads never contact providers.
- Do not add a remote provider-fetch REST or MCP endpoint.
- Treat catalogue terms review, technical compatibility, and live success as informational evidence, never provider authorization or permission for commercial use, caching, or redistribution.
- Keep all source and connector activation fail-closed by default.
- Implement every behavior with a red-green-refactor cycle and commit at each independently reviewable task boundary.

---

## File Structure

### Recipe contract and generated artifacts

- `access/schemas/access-recipe.schema.json`: normative JSON Schema for source-access recipes.
- `access/recipes/official/hkapi-NNN.yml`: one reviewed recipe or explicit non-executable classification per official resource.
- `access/verification/hkapi-NNN.json`: optional metadata-only current verification evidence.
- `access/generated/recipes.json`: deterministic public recipe index with effective status and recipe hashes.
- `access/generated/examples/{curl,python,typescript}/hkapi-NNN.*`: deterministic executable examples for executable recipes.
- `access/generated/coverage.json`: derived counts by persisted and effective status, with zero unclassified official records.

### Python access runtime

- `services/worker/hk_data_worker/access/models.py`: Pydantic recipe, request, response, evidence, and error contracts.
- `services/worker/hk_data_worker/access/registry.py`: safe YAML loading, cross-catalogue validation, hashing, and lookups.
- `services/worker/hk_data_worker/access/examples.py`: shell-safe curl, Python, and TypeScript example rendering.
- `services/worker/hk_data_worker/access/planning.py`: parameter coercion and `ApprovedRequest` construction.
- `services/worker/hk_data_worker/access/selectors.py`: bounded JSON Pointer, XPath subset, CSV, feed, feature, and whole-document selection.
- `services/worker/hk_data_worker/access/normalization.py`: stable record keys, timestamps, language, geometry, and field mappings.
- `services/worker/hk_data_worker/access/evidence.py`: verification fingerprints and atomic metadata-only evidence writes.
- `services/worker/hk_data_worker/access/execution.py`: one bounded fetch/verify orchestration path using `SafeFetcher`.
- `services/worker/hk_data_worker/adapters/*.py`: ten protocol adapters and the fixed adapter registry.
- `scripts/access.py`: repository validation and deterministic generation command.

### Public interfaces

- `packages/sdk-python/src/hk_data_sdk/cli.py`: `hkdata` command-line interface.
- `packages/sdk-python/src/hk_data_sdk/access.py`: Python REST SDK recipe methods and public typed results.
- `packages/sdk-typescript/src/types.ts`: TypeScript recipe result types.
- `packages/sdk-typescript/src/client.ts`: TypeScript REST SDK recipe methods.
- `packages/schemas/src/access.ts`: Zod validation and generated-index loader shared by TypeScript services.
- `services/api/src/routes/access-recipes.ts`: read-only recipe list and detail routes.
- `services/mcp/src/tools/access-recipes.ts`: two read-only MCP recipe tool schemas.
- `apps/catalog/src/components/AccessPanel.tsx`: status, parameters, examples, evidence, and limitations on resource detail pages.

### Verification

- `tests/access/`: schema, generator, planner, adapter, execution, evidence, CLI, coverage, and live-smoke tests.
- `tests/fixtures/access/`: authored synthetic request/response fixtures with hashes and provenance.
- Existing package tests are extended only where the new interfaces enter those packages.

---

### Task 1: Define and load the recipe contract

**Files:**
- Create: `access/schemas/access-recipe.schema.json`
- Create: `services/worker/hk_data_worker/access/__init__.py`
- Create: `services/worker/hk_data_worker/access/models.py`
- Create: `services/worker/hk_data_worker/access/registry.py`
- Create: `packages/schemas/src/access.ts`
- Modify: `packages/schemas/src/index.ts`
- Create: `tests/access/__init__.py`
- Create: `tests/access/fixtures/valid/hkapi-001.yml`
- Create: `tests/access/fixtures/invalid/credential-value.yml`
- Create: `tests/access/test_recipe_schema.py`
- Create: `packages/schemas/src/access.test.ts`

**Interfaces:**
- Consumes: catalogue source references from `catalog/official/*.yml` and verification metadata from `access/verification/*.json`.
- Produces: `AccessRecipe`, `AccessRequest`, `ResponseSpec`, `VerificationEvidence`, `load_recipes(root) -> tuple[AccessRecipe, ...]`, `loadAccessRecipeIndex(path) -> AccessRecipeIndex`.

- [ ] **Step 1: Write failing Python contract tests**

```python
def test_valid_executable_recipe_loads() -> None:
    recipes = load_recipes(FIXTURES / "valid")
    assert recipes[0].source_reference == "HKAPI-001"
    assert recipes[0].request is not None
    assert recipes[0].request.allowed_hosts == ("data.gov.hk",)


def test_recipe_rejects_embedded_credential_values() -> None:
    with pytest.raises(RecipeRegistryError, match="credential values are forbidden"):
        load_recipes(FIXTURES / "invalid")
```

- [ ] **Step 2: Run the Python tests and verify contract loading is absent**

Run: `uv run pytest tests/access/test_recipe_schema.py -q`

Expected: FAIL because `hk_data_worker.access.registry` does not exist.

- [ ] **Step 3: Add the JSON Schema and immutable Pydantic models**

```python
class AccessStatus(StrEnum):
    LIVE_VERIFIED = "live-verified"
    FIXTURE_TESTED = "fixture-tested"
    CREDENTIAL_REQUIRED = "credential-required"
    MANUAL_ONLY = "manual-only"
    BLOCKED = "blocked"
    UNAVAILABLE = "unavailable"


class AccessRecipe(ContractModel):
    schema_version: Literal[1]
    source_reference: Annotated[str, Field(pattern=r"^HKAPI-[0-9]{3}$")]
    recipe_version: Annotated[str, Field(pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$")]
    adapter: AdapterName
    status: AccessStatus
    documentation_url: HttpsUrl
    limitations: tuple[str, ...]
    reason: str | None = None
    next_action: str | None = None
    authentication: AuthenticationSpec
    request: AccessRequest | None
    response: ResponseSpec | None
```

Configure the access model base with `alias_generator=to_camel`, `populate_by_name=True`, and serialization by alias so YAML/generated JSON consistently use `sourceReference`, `recipeVersion`, and the remaining camel-case contract fields while Python uses snake-case attributes. Add model validators for the status/request matrix, HTTPS and host rules, environment-variable names, numeric bounds, unique parameter names, and fixed adapter names. Load YAML with the existing timestamp resolver disabled, validate it against the JSON Schema, reject duplicate source references, and return recipes sorted numerically.

- [ ] **Step 4: Add equivalent Zod types and loader tests**

```typescript
export const accessStatusSchema = z.enum([
  "live-verified",
  "fixture-tested",
  "credential-required",
  "manual-only",
  "blocked",
  "unavailable",
]);

export const accessRecipeIndexSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().nullable(),
  recipes: z.array(accessRecipeSchema),
  coverage: accessCoverageSchema,
});
```

Run: `pnpm --filter @hk-open-data/schemas test -- access.test.ts`

Expected: PASS for valid generated data and FAIL parsing a recipe with an unknown status or embedded secret field.

- [ ] **Step 5: Run contract checks and commit**

Run: `uv run pytest tests/access/test_recipe_schema.py -q && pnpm --filter @hk-open-data/schemas test -- access.test.ts && pnpm --filter @hk-open-data/schemas typecheck`

Expected: PASS.

```bash
git add access/schemas services/worker/hk_data_worker/access packages/schemas/src tests/access
git commit -m "feat: define source access recipe contract"
```

### Task 2: Validate catalogue coverage and generate deterministic artifacts

**Files:**
- Create: `services/worker/hk_data_worker/access/examples.py`
- Create: `services/worker/hk_data_worker/access/generation.py`
- Create: `scripts/access.py`
- Create: `tests/access/test_generation.py`
- Create: `tests/access/test_examples.py`
- Modify: `package.json`
- Modify: `Makefile`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `load_recipes`, official catalogue YAML, and validated verification evidence.
- Produces: `validate_access_registry(...) -> list[str]`, `generate_access_artifacts(...) -> AccessRecipeIndex`, `render_example(recipe, language) -> str`, and repository commands `access:validate`, `access:generate`, `access:check`.

- [ ] **Step 1: Write failing cross-registry and determinism tests**

```python
def test_complete_registry_rejects_missing_duplicate_and_orphan_references(tmp_path: Path) -> None:
    findings = validate_access_registry(
        catalogue_references=("HKAPI-001", "HKAPI-002"),
        recipes=(recipe("HKAPI-001"), recipe("HKAPI-003"), recipe("HKAPI-003")),
        evidence=(),
    )
    assert findings == [
        "duplicate recipe: HKAPI-003",
        "missing recipe: HKAPI-002",
        "orphan recipe: HKAPI-003",
    ]


def test_generation_is_byte_for_byte_reproducible(tmp_path: Path) -> None:
    generate_access_artifacts(INPUT, tmp_path)
    first = file_hashes(tmp_path)
    generate_access_artifacts(INPUT, tmp_path)
    assert file_hashes(tmp_path) == first


def test_each_example_encodes_the_declared_request() -> None:
    expected = ("GET", "https://data.gov.hk/en-data/api/3/action/package_list?limit=10&offset=0")
    assert inspect_curl(render_example(executable_recipe(), "curl"))[:2] == expected
    assert inspect_python(render_example(executable_recipe(), "python"))[:2] == expected
    assert inspect_typescript(render_example(executable_recipe(), "typescript"))[:2] == expected
```

- [ ] **Step 2: Run generator tests and confirm they fail**

Run: `uv run pytest tests/access/test_generation.py tests/access/test_examples.py -q`

Expected: FAIL because generation and example rendering are undefined.

- [ ] **Step 3: Implement stable hashes, effective status, and public outputs**

```python
def effective_status(recipe: AccessRecipe, evidence: VerificationEvidence | None, now: datetime) -> AccessStatus:
    if recipe.status is not AccessStatus.LIVE_VERIFIED:
        return recipe.status
    if evidence is None or evidence.recipe_sha256 != recipe_sha256(recipe) or evidence.valid_until <= now:
        return AccessStatus.FIXTURE_TESTED
    return AccessStatus.LIVE_VERIFIED
```

Serialize with `ensure_ascii=False`, `indent=2`, and `sort_keys=True`; omit volatile generation time by setting `generatedAt` to `null` in committed artifacts. Write to a temporary sibling and use `Path.replace()` only after schema validation. Generate coverage counts from effective statuses and calculate the canonical SHA-256 from normalized JSON.

- [ ] **Step 4: Implement curl, Python, and TypeScript renderers**

```python
def render_curl(recipe: AccessRecipe) -> str:
    request = require_request(recipe)
    argv = ["curl", "--fail-with-body", "--silent", "--show-error", "--max-time", seconds(request.timeout_ms)]
    argv.extend(("--request", request.method, render_url(recipe)))
    return " \\\n+  ".join(shlex.quote(value) for value in argv) + "\n"
```

Python examples use `httpx.Client(follow_redirects=False)` and explicit timeouts. TypeScript examples use `fetch`, `AbortSignal.timeout`, and an explicit `response.ok` check. Credentialed examples read the declared environment variable and stop before a request when it is missing.

- [ ] **Step 5: Add repository commands and drift checks**

```json
{
  "access:validate": "uv run python scripts/access.py validate",
  "access:generate": "uv run python scripts/access.py generate",
  "access:check": "uv run python scripts/access.py check"
}
```

Add `verify-access` to `Makefile` and include it in `verify-all`. Ignore only temporary evidence files matching `access/verification/*.tmp`; keep generated examples and metadata evidence tracked.

- [ ] **Step 6: Verify and commit**

Run: `uv run pytest tests/access/test_generation.py tests/access/test_examples.py -q && git diff --check`

Expected: PASS, including shell parsing through `bash -n`, Python parsing through `ast.parse`, TypeScript compilation through a temporary `tsc --noEmit` project, and byte-for-byte regeneration.

```bash
git add access services/worker/hk_data_worker/access scripts/access.py tests/access package.json Makefile .gitignore
git commit -m "feat: generate source access artifacts"
```

### Task 3: Plan safe requests from declared parameters

**Files:**
- Create: `services/worker/hk_data_worker/access/errors.py`
- Create: `services/worker/hk_data_worker/access/planning.py`
- Create: `services/worker/hk_data_worker/adapters/__init__.py`
- Create: `services/worker/hk_data_worker/adapters/base.py`
- Create: `tests/access/test_planning.py`
- Modify: `services/worker/hk_data_worker/models.py`
- Modify: `services/worker/hk_data_worker/fetch.py`

**Interfaces:**
- Consumes: `AccessRecipe`, user parameter strings, environment variables, and the existing `ApprovedRequest`/`SafeFetcher` types.
- Produces: `AccessFailure(code, message, retryable, source_reference, recipe_version, correlation_id)`, `coerce_parameters(...)`, `plan_request(...) -> tuple[ApprovedRequest, ...]`, and adapter protocol `plan`/`parse`.

- [ ] **Step 1: Write failing safety and parameter tests**

```python
@pytest.mark.parametrize("value", ["https://evil.example/x", "../admin", "a&next=https://evil.example"])
def test_parameter_cannot_change_allowlisted_host(value: str) -> None:
    with pytest.raises(AccessFailure) as caught:
        plan_request(recipe_with_enum_parameter(), {"lang": value}, environ={})
    assert caught.value.code == "INVALID_PARAMETER"


def test_missing_credential_fails_before_fetch() -> None:
    with pytest.raises(AccessFailure) as caught:
        plan_request(credential_recipe(), {}, environ={})
    assert caught.value.code == "AUTH_REQUIRED"


def test_generated_examples_match_the_request_planner() -> None:
    planned = plan_request(executable_recipe(), {}, environ={})[0]
    signature = request_signature(planned)
    assert inspect_curl(render_example(executable_recipe(), "curl")) == signature
    assert inspect_python(render_example(executable_recipe(), "python")) == signature
    assert inspect_typescript(render_example(executable_recipe(), "typescript")) == signature
```

- [ ] **Step 2: Run planner tests and verify failure**

Run: `uv run pytest tests/access/test_planning.py -q`

Expected: FAIL because `plan_request` and stable access errors do not exist.

- [ ] **Step 3: Implement typed parameter coercion and URL expansion**

```python
def coerce_parameter(spec: ParameterSpec, raw: object) -> str | int | float | bool:
    value = spec.default if raw is None else raw
    if value is None and spec.required:
        raise access_failure("INVALID_PARAMETER", f"Missing parameter: {spec.name}")
    parsed = parse_declared_type(spec.data_type, value)
    if spec.enum and parsed not in spec.enum:
        raise access_failure("INVALID_PARAMETER", f"Unsupported value for {spec.name}")
    return parsed
```

Use `urllib.parse.urlencode` for query parameters and percent-encode path substitutions as one segment. Reparse the final URL, require HTTPS, reject user info/fragments/non-443 ports, and require its normalized hostname in `allowedHosts`.

- [ ] **Step 4: Tighten the shared request/fetch limits**

Change `ApprovedRequest.timeout_ms` to at most `60_000`, `max_response_bytes` to at most `26_214_400`, `max_attempts` to at most `3`, and add `allowed_media_types`. Have `SafeFetcher` raise stable subclasses for an unsafe redirect, response limit, timeout, and retry exhaustion without including provider bodies or credential material.

- [ ] **Step 5: Verify focused fetch and planner tests and commit**

Run: `uv run pytest tests/access/test_planning.py tests/security/test_safe_fetch.py -q && uv run mypy services/worker`

Expected: PASS with no request emitted for invalid input, missing credentials, or a status that disallows execution.

```bash
git add services/worker/hk_data_worker/access services/worker/hk_data_worker/adapters services/worker/hk_data_worker/models.py services/worker/hk_data_worker/fetch.py tests/access/test_planning.py tests/security/test_safe_fetch.py
git commit -m "feat: plan bounded source requests"
```

### Task 4: Parse JSON-family protocols with declarative selectors

**Files:**
- Create: `services/worker/hk_data_worker/access/selectors.py`
- Create: `services/worker/hk_data_worker/access/normalization.py`
- Create: `services/worker/hk_data_worker/adapters/rest_json.py`
- Create: `services/worker/hk_data_worker/adapters/ckan_action.py`
- Create: `services/worker/hk_data_worker/adapters/odata.py`
- Create: `services/worker/hk_data_worker/adapters/arcgis_rest.py`
- Create: `tests/access/test_json_adapters.py`
- Create: `tests/fixtures/access/json/manifest.json`
- Create: `tests/fixtures/access/json/*.json`

**Interfaces:**
- Consumes: adapter protocol and `ResponseSpec.recordPath`, `idPath`, `timestampPath`, pagination, and normalization mappings.
- Produces: `select_json_pointer`, `normalize_records`, and adapters `rest-json`, `ckan-action`, `odata`, `arcgis-rest` returning `tuple[SourceRecordDraft, ...]`.

- [ ] **Step 1: Write failing adapter contract cases**

```python
@pytest.mark.parametrize(
    ("adapter", "record_path", "fixture", "expected"),
    [
        ("ckan-action", "/result", "ckan-list.json", 2),
        ("ckan-action", "/result", "ckan-object.json", 1),
        ("odata", "/value", "odata.json", 2),
        ("arcgis-rest", "/features", "arcgis.json", 2),
        ("rest-json", "/data", "rest.json", 2),
    ],
)
def test_json_adapters_accept_declared_shapes(adapter: str, record_path: str, fixture: str, expected: int) -> None:
    assert len(parse_fixture(adapter, record_path, fixture)) == expected
```

Add cases for empty success, malformed JSON, missing record path, unexpected media type, prompt-like provider text, missing IDs, and timestamp offsets.

- [ ] **Step 2: Run JSON adapter tests and verify failure**

Run: `uv run pytest tests/access/test_json_adapters.py -q`

Expected: FAIL because the JSON adapters are not registered.

- [ ] **Step 3: Implement safe selectors and deterministic normalization**

```python
def select_json_pointer(document: object, pointer: str) -> object:
    current = document
    for token in pointer.lstrip("/").split("/") if pointer else ():
        key = token.replace("~1", "/").replace("~0", "~")
        current = current[int(key)] if isinstance(current, list) else require_mapping(current)[key]
    return current
```

Treat an object at `recordPath` as one record and an array as many records. Reject scalar selections. Compute stable IDs from `sourceReference`, declared `idPath` or deterministic array position, and canonical record JSON. Preserve prompt-like strings as inert fields.

- [ ] **Step 4: Implement the four JSON-family adapters**

CKAN requires `success: true` and supports either an array or object `result`. OData supports `value` and declared `@odata.nextLink`. ArcGIS accepts `features`, count responses, and declared error objects; it never follows URLs found in feature attributes. REST JSON uses only the recipe's declared selectors.

- [ ] **Step 5: Verify and commit**

Run: `uv run pytest tests/access/test_json_adapters.py tests/contract/test_transform_provenance.py -q && uv run ruff check services/worker tests/access`

Expected: PASS with identical record IDs and hashes on replay.

```bash
git add services/worker/hk_data_worker/access services/worker/hk_data_worker/adapters tests/access tests/fixtures/access/json
git commit -m "feat: add declarative JSON source adapters"
```

### Task 5: Parse XML, feeds, tabular files, downloads, and OGC responses

**Files:**
- Create: `services/worker/hk_data_worker/adapters/xml.py`
- Create: `services/worker/hk_data_worker/adapters/csv.py`
- Create: `services/worker/hk_data_worker/adapters/rss.py`
- Create: `services/worker/hk_data_worker/adapters/file_download.py`
- Create: `services/worker/hk_data_worker/adapters/ogc_wfs.py`
- Create: `services/worker/hk_data_worker/adapters/ogc_wms.py`
- Create: `tests/access/test_document_adapters.py`
- Create: `tests/fixtures/access/documents/manifest.json`
- Create: `tests/fixtures/access/documents/*`

**Interfaces:**
- Consumes: adapter protocol, safe XPath subset, CSV dialect, declared feed item, OGC operation, and whole-document response selectors.
- Produces: adapters `xml`, `csv`, `rss`, `file-download`, `ogc-wfs`, and `ogc-wms` in the fixed registry.

- [ ] **Step 1: Write failing document adapter tests**

```python
@pytest.mark.parametrize(
    ("adapter", "fixture", "expected"),
    [
        ("xml", "records.xml", 2),
        ("csv", "records.csv", 2),
        ("rss", "feed.xml", 2),
        ("file-download", "document.bin", 1),
        ("ogc-wfs", "feature-collection.xml", 2),
        ("ogc-wms", "capabilities.xml", 1),
    ],
)
def test_document_adapter_contract(adapter: str, fixture: str, expected: int) -> None:
    assert len(parse_document_fixture(adapter, fixture)) == expected
```

Add entity-expansion rejection, malformed XML, CSV header mismatch, oversized row, feed without entries, WFS exception report, unsupported WMS operation, media mismatch, and geometry validation cases.

- [ ] **Step 2: Run document tests and verify failure**

Run: `uv run pytest tests/access/test_document_adapters.py -q`

Expected: FAIL because the six adapters are absent.

- [ ] **Step 3: Implement bounded parsers without dynamic code or external entities**

Use `xml.etree.ElementTree.XMLParser` with a preparse rejection for `<!DOCTYPE` and `<!ENTITY`, `csv.DictReader` with declared encoding/dialect, and fixed field extraction. A file download emits one metadata record containing media type, byte count, and SHA-256, not response bytes. WFS and WMS accept only the declared operation and selector.

- [ ] **Step 4: Register exactly ten adapters**

```python
ADAPTERS: dict[AdapterName, AccessAdapter] = {
    "ckan-action": CkanActionAdapter(),
    "rest-json": RestJsonAdapter(),
    "odata": ODataAdapter(),
    "arcgis-rest": ArcGisRestAdapter(),
    "ogc-wfs": OgcWfsAdapter(),
    "ogc-wms": OgcWmsAdapter(),
    "xml": XmlAdapter(),
    "csv": CsvAdapter(),
    "rss": RssAdapter(),
    "file-download": FileDownloadAdapter(),
}
```

- [ ] **Step 5: Verify and commit**

Run: `uv run pytest tests/access/test_document_adapters.py -q && uv run mypy services/worker && uv run ruff check services/worker tests/access`

Expected: PASS; adapter registry keys exactly match the approved ten names.

```bash
git add services/worker/hk_data_worker/adapters tests/access/test_document_adapters.py tests/fixtures/access/documents
git commit -m "feat: add document and geospatial adapters"
```

### Task 6: Execute recipes and write metadata-only verification evidence

**Files:**
- Create: `services/worker/hk_data_worker/access/evidence.py`
- Create: `services/worker/hk_data_worker/access/execution.py`
- Create: `tests/access/test_execution.py`
- Create: `tests/access/test_verification_evidence.py`
- Modify: `services/worker/hk_data_worker/fetch.py`
- Modify: `services/worker/hk_data_worker/hashing.py`

**Interfaces:**
- Consumes: recipe registry, adapter registry, `SafeFetcher`, and an explicit `ExecutionIntent` of `fetch` or `verify`.
- Produces: `execute_recipe(...) -> ExecutionResult`, `verify_recipe(...) -> VerificationEvidence`, `write_evidence_atomic(path, evidence)`, and stable access exit/error codes.

- [ ] **Step 1: Write failing execution-boundary tests**

```python
def test_fixture_tested_fetch_requires_explicit_override(fetcher: SpyFetcher) -> None:
    with pytest.raises(AccessFailure) as caught:
        execute_recipe(fixture_tested_recipe(), {}, fetcher=fetcher)
    assert caught.value.code == "RECIPE_NOT_EXECUTABLE"
    assert fetcher.requests == []


def test_verification_evidence_contains_hashes_not_body(tmp_path: Path) -> None:
    evidence = verify_recipe(live_candidate(), fetcher=fixture_fetcher(b'{"data":[]}'))
    write_evidence_atomic(tmp_path / "hkapi-001.json", evidence)
    text = (tmp_path / "hkapi-001.json").read_text()
    assert '"responseSha256"' in text
    assert '"data"' not in text
```

- [ ] **Step 2: Run execution tests and verify failure**

Run: `uv run pytest tests/access/test_execution.py tests/access/test_verification_evidence.py -q`

Expected: FAIL because the execution and evidence modules are absent.

- [ ] **Step 3: Implement one request-fetch-parse-normalize pipeline**

```python
def execute_recipe(recipe: AccessRecipe, parameters: Mapping[str, object], *, fetcher: Fetcher, allow_unverified: bool = False) -> ExecutionResult:
    assert_execution_allowed(recipe, allow_unverified=allow_unverified)
    requests = ADAPTERS[recipe.adapter].plan(recipe, dict(parameters))
    records: list[SourceRecordDraft] = []
    for request in requests:
        response = fetcher.fetch(request)
        records.extend(ADAPTERS[recipe.adapter].parse(recipe, digest_ref(response), response))
    return ExecutionResult(records=tuple(records), responses=metadata_only(response))
```

Do not publish records until all pages validate. Enforce duplicate record detection, media types, pagination loops, page bounds, and no partial results after quarantine.

- [ ] **Step 4: Implement atomic evidence with a structural fingerprint**

Fingerprint JSON from sorted key paths and primitive kinds, XML from namespace-qualified element paths, CSV from ordered headers, and files from media type plus byte length. Write a same-directory temporary file with mode `0600`, validate the serialized evidence, `fsync`, replace the target, and remove the temporary file on failure.

- [ ] **Step 5: Verify execution safety and commit**

Run: `uv run pytest tests/access/test_execution.py tests/access/test_verification_evidence.py tests/security/test_safe_fetch.py -q`

Expected: PASS; no test path records raw response bytes in verification files.

```bash
git add services/worker/hk_data_worker/access services/worker/hk_data_worker/fetch.py services/worker/hk_data_worker/hashing.py tests/access
git commit -m "feat: execute and verify access recipes safely"
```

### Task 7: Expose the repository-local `hkdata` CLI

**Files:**
- Create: `services/worker/pyproject.toml`
- Create: `packages/sdk-python/src/hk_data_sdk/cli.py`
- Modify: `packages/sdk-python/src/hk_data_sdk/__init__.py`
- Modify: `packages/sdk-python/pyproject.toml`
- Modify: `pyproject.toml`
- Modify: `uv.lock`
- Modify: `Makefile`
- Create: `tests/access/test_cli.py`

**Interfaces:**
- Consumes: recipe registry, generated examples, access execution, environment credentials, stdout, and stderr.
- Produces: `hkdata recipe`, `example`, `fetch`, and `verify` commands with exit codes 0, 2, 3, 4, 5, 6, and 7.

- [ ] **Step 1: Write failing CLI tests**

```python
def test_recipe_command_is_offline(monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]) -> None:
    monkeypatch.setattr(SafeFetcher, "fetch", lambda *_: pytest.fail("network used"))
    assert main(["recipe", "HKAPI-001", "--format", "json"]) == 0
    assert json.loads(capsys.readouterr().out)["sourceReference"] == "HKAPI-001"


def test_fetch_writes_data_to_stdout_and_diagnostics_to_stderr(capsys: pytest.CaptureFixture[str]) -> None:
    code = main(["fetch", "HKAPI-001", "--allow-unverified", "--output", "ndjson"], fetcher=fixture_fetcher())
    captured = capsys.readouterr()
    assert code == 0
    assert json.loads(captured.out.splitlines()[0])["source_reference"] == "HKAPI-001"
    assert "response_sha256" in captured.err
```

- [ ] **Step 2: Run CLI tests and verify failure**

Run: `uv run pytest tests/access/test_cli.py -q`

Expected: FAIL because `hk_data_sdk.cli` does not exist.

- [ ] **Step 3: Package the worker access runtime as an SDK dependency**

Give `services/worker/pyproject.toml` project name `hk-data-worker`, version `0.1.0`, Python `>=3.12`, and its existing `httpx`, `pydantic`, `boto3`, and `psycopg` dependencies. Add `packages/sdk-python` and `services/worker` to the root `[tool.uv.workspace].members`, add `hk-data-worker==0.1.0` and `pyyaml>=6,<7` to the SDK, configure `tool.uv.sources.hk-data-worker = { workspace = true }`, and add:

```toml
[project.scripts]
hkdata = "hk_data_sdk.cli:entrypoint"
```

- [ ] **Step 4: Implement argparse commands and stable exit mapping**

```python
EXIT_BY_CODE = {
    "INVALID_PARAMETER": 2,
    "AUTH_REQUIRED": 3,
    "SOURCE_UNAVAILABLE": 4,
    "SCHEMA_MISMATCH": 5,
    "RECIPE_NOT_EXECUTABLE": 6,
    "UNSAFE_REDIRECT": 7,
    "RESPONSE_TOO_LARGE": 7,
}
```

Default `verify --all-anonymous` to concurrency one, reject values above three, and sort sources numerically. Add Make targets that invoke `uv run --project packages/sdk-python hkdata` so users need no global Python install.

- [ ] **Step 5: Verify installation and CLI behavior and commit**

Run: `uv lock && uv run pytest tests/access/test_cli.py -q && uv run --project packages/sdk-python hkdata --help && uv run mypy services/worker packages/sdk-python/src`

Expected: PASS and help lists exactly `recipe`, `example`, `fetch`, and `verify`.

```bash
git add services/worker/pyproject.toml packages/sdk-python pyproject.toml uv.lock Makefile tests/access/test_cli.py
git commit -m "feat: add local source access CLI"
```

### Task 8: Replace broad parser assumptions for the 22 current runtime sources

**Files:**
- Create: `access/recipes/official/hkapi-{001,002,003,004,005,006,007,008,009,010,012,013,014,015,016,017,018,019,020,021,023,034}.yml`
- Create: `tests/fixtures/access/current-sources/manifest.json`
- Create: `tests/fixtures/access/current-sources/hkapi-NNN/*`
- Create: `tests/access/test_current_sources.py`
- Modify: `services/worker/hk_data_worker/execution.py`
- Modify: `services/worker/hk_data_worker/connectors/base.py`
- Modify: `services/worker/hk_data_worker/connectors/__init__.py`
- Modify: `services/api/src/routes/admin.ts`
- Modify: `services/api/src/repository.ts`
- Modify: `services/api/src/memory-repository.ts`
- Modify: `services/api/src/postgres-repository.ts`
- Modify: `services/api/src/app.admin.test.ts`

**Interfaces:**
- Consumes: recipe registry and the 21 P01 source IDs plus `HKAPI-034` from the current monitor registry.
- Produces: source-specific parser dispatch keyed by `sourceReference`; source-group IDs remain reporting labels only.

- [ ] **Step 1: Write failing compatibility tests for the exact current set**

```python
CURRENT_REFERENCES = {
    "HKAPI-001", "HKAPI-002", "HKAPI-003", "HKAPI-004", "HKAPI-005", "HKAPI-006",
    "HKAPI-007", "HKAPI-008", "HKAPI-009", "HKAPI-010", "HKAPI-012", "HKAPI-013",
    "HKAPI-014", "HKAPI-015", "HKAPI-016", "HKAPI-017", "HKAPI-018", "HKAPI-019",
    "HKAPI-020", "HKAPI-021", "HKAPI-023", "HKAPI-034",
}

def test_current_runtime_sources_have_source_specific_recipe_fixtures() -> None:
    assert set(load_current_fixture_manifest()) == CURRENT_REFERENCES
    for reference in sorted(CURRENT_REFERENCES):
        recipe = get_recipe(reference)
        if recipe.request is None:
            assert recipe.reason and recipe.next_action
        else:
            assert_recipe_parses_its_own_fixture(reference)
```

Include separate CKAN fixtures for list results and object results so `package_show` and `group_show` cannot regress to the old array-only assumption.

- [ ] **Step 2: Run current-source tests and verify failure**

Run: `uv run pytest tests/access/test_current_sources.py -q`

Expected: FAIL because the source-specific recipes and fixtures are absent.

- [ ] **Step 3: Author the 22 source-specific recipes from their linked official documentation**

Use safe parameters from `packages/schemas/contracts/p14-monitor-targets.csv` only when they are explicitly bounded and documented. Mark registration, dependency, policy, or personal-data-sensitive sources with the appropriate non-live status. Record fixture provenance as `synthetic-authored`, the recipe hash, response media type, fixture SHA-256, and the exact provider documentation URL in the fixture manifest.

- [ ] **Step 4: Dispatch runtime connectors by recipe reference**

```python
recipe = self._recipes.get(definition.source_id)
if recipe is None:
    raise ExecutionBlocked("RECIPE_NOT_FOUND")
requests = ADAPTERS[recipe.adapter].plan(recipe, definition.parameters, approval=approval)
records = ADAPTERS[recipe.adapter].parse(recipe, raw, response)
```

Change connector activation input from arbitrary endpoint/body/parser selection to `recipeReference` plus declared parameter overrides. The API must reject a recipe/source mismatch and any parameter not present in the recipe.

- [ ] **Step 5: Prove existing execution gates still apply and commit**

Run: `uv run pytest tests/access/test_current_sources.py tests/contract/test_connectors.py tests/integration/test_job_execution.py -q && pnpm --filter @hk-open-data/api test -- app.admin.test.ts`

Expected: PASS; approval, fabric profile, provider-access switch, raw-before-parse, quarantine, and lease controls remain enforced.

```bash
git add access/recipes/official tests/fixtures/access/current-sources tests/access/test_current_sources.py services/worker/hk_data_worker services/api/src
git commit -m "feat: migrate current sources to access recipes"
```

### Task 9: Classify every official source and complete recipe coverage

**Files:**
- Create: `access/recipes/official/hkapi-001.yml` through `access/recipes/official/hkapi-265.yml` not already added in Task 8
- Create: `tests/fixtures/access/official/manifest.json`
- Create: `tests/fixtures/access/official/hkapi-NNN/*` for every executable recipe
- Create: `tests/access/test_official_coverage.py`
- Create: `docs/access/source-status.md`

**Interfaces:**
- Consumes: all 265 official catalogue records, each record's current authoritative documentation/landing URL, adapter contract, and source-specific terms notes.
- Produces: complete one-to-one official recipe coverage, synthetic fixtures for every executable recipe, and derived status counts.

- [ ] **Step 1: Write the failing completeness and truthfulness tests**

```python
def test_every_published_official_resource_has_exactly_one_recipe() -> None:
    official = {f"HKAPI-{number:03d}" for number in range(1, 266)}
    recipes = load_recipes(Path("access/recipes/official"))
    assert {recipe.source_reference for recipe in recipes} == official
    assert len(recipes) == len({recipe.source_reference for recipe in recipes}) == 265


def test_every_executable_recipe_has_a_hashed_synthetic_fixture() -> None:
    manifest = load_fixture_manifest()
    executable = {recipe.source_reference for recipe in load_official_recipes() if recipe.request}
    assert set(manifest) == executable
    assert all(entry["provenance"] == "synthetic-authored" for entry in manifest.values())
```

- [ ] **Step 2: Run official coverage tests and verify the exact missing-reference list**

Run: `uv run pytest tests/access/test_official_coverage.py -q`

Expected: FAIL and print the remaining source references after Task 8; no source may disappear from the failure output.

- [ ] **Step 3: Audit `HKAPI-001`–`HKAPI-053`**

For each record, open the exact `urls.documentation` or `urls.landing` authority page; select an adapter only for a documented machine interface; copy the exact endpoint template and bounded parameter rules; otherwise use `manual-only`, `credential-required`, `blocked`, or `unavailable` with a concrete reason and next action. Recheck the 22 Task 8 records in this range rather than assuming the monitor template proves compatibility.

- [ ] **Step 4: Audit `HKAPI-054`–`HKAPI-106` using the same contract**

Do not infer endpoints from site naming patterns or search-result snippets. When a provider supplies only a downloadable file, use `file-download`; when the page documents a dataset but no stable machine URL, use `manual-only`.

- [ ] **Step 5: Audit `HKAPI-107`–`HKAPI-159` using the same contract**

Credential and registration requirements must name environment-variable setup without a value. A login form, CAPTCHA, browser session, or undocumented request is not an executable recipe.

- [ ] **Step 6: Audit `HKAPI-160`–`HKAPI-212` using the same contract**

For geospatial services, identify the exact published WFS, WMS, or ArcGIS operation and cap feature counts or map dimensions. Do not mirror tiles or bulk layers during verification.

- [ ] **Step 7: Audit `HKAPI-213`–`HKAPI-265` using the same contract**

For dashboards and reports, classify the underlying documented download/API if one exists; otherwise classify the published interface as manual-only. Do not treat an HTML page scraper as documented machine access.

- [ ] **Step 8: Author synthetic fixtures for every executable recipe**

Each manifest entry contains `sourceReference`, `recipeSha256`, `requestFixture`, `responseFixture`, `responseSha256`, `mediaType`, `provenance: synthetic-authored`, and `documentationUrl`. Exercise the declared record path, ID, timestamp, language, geometry, and pagination behavior.

- [ ] **Step 9: Generate the full registry and verify zero unclassified resources**

Run: `uv run pytest tests/access/test_official_coverage.py -q && uv run python scripts/access.py generate && uv run python scripts/access.py check`

Expected: PASS with 265 recipes, zero missing references, zero orphans, zero duplicates, zero unclassified records, and a fixture for every executable recipe.

- [ ] **Step 10: Commit the reviewed official registry**

```bash
git add access/recipes/official access/generated tests/fixtures/access/official tests/access/test_official_coverage.py docs/access/source-status.md
git commit -m "data: add actionable access guidance for official sources"
```

### Task 10: Join recipe state into catalogue generation

**Files:**
- Modify: `scripts/catalog.py`
- Modify: `tests/catalog/test_catalog.py`
- Modify: `catalog/schemas/resource.schema.json`
- Modify: `packages/schemas/src/catalogue.ts`
- Modify: `packages/schemas/src/catalogue.test.ts`
- Modify: `apps/catalog/vite.config.ts`
- Modify: `apps/catalog/scripts/build-static.mjs`
- Modify: `catalog/generated/*.json`

**Interfaces:**
- Consumes: `access/generated/recipes.json` joined by exact `sourceReference`.
- Produces: catalogue `accessRecipe` projection, generated integration states, access coverage counts, and static `access-recipes.json`.

- [ ] **Step 1: Write failing catalogue join tests**

```python
def test_official_integration_state_is_generated_from_recipe() -> None:
    catalogue = build_catalogue(records(), access_index())
    source = next(item for item in catalogue["resources"] if item["sourceReference"] == "HKAPI-001")
    assert source["integrations"]["connector"] == "available"
    assert source["accessRecipe"]["recipeSha256"] == access_index()["recipes"][0]["recipeSha256"]


def test_non_executable_recipe_does_not_claim_connector_availability() -> None:
    source = build_with_status("manual-only")
    assert source["integrations"]["connector"] == "none"
```

- [ ] **Step 2: Run catalogue tests and verify failure**

Run: `uv run pytest tests/catalog/test_catalog.py -q && pnpm --filter @hk-open-data/schemas test -- catalogue.test.ts`

Expected: FAIL because catalogue generation does not consume access recipes.

- [ ] **Step 3: Implement the deterministic join**

```python
def connector_state(recipe: dict[str, object]) -> str:
    if recipe["request"] is not None and recipe["effectiveStatus"] in {"live-verified", "fixture-tested", "credential-required"}:
        return "available"
    if recipe["status"] in {"blocked", "unavailable"}:
        return "planned"
    return "none"
```

Reject any official resource without a recipe and any official recipe without a resource. Do not mutate source YAML. Copy the validated access index to `catalog/generated/access-recipes.json` and add it to catalogue drift checks.

- [ ] **Step 4: Make the static build require access artifacts**

Add `access-recipes.json` to the Vite public assets and static build assertions. Verify static page generation performs only local file reads and build subprocesses.

- [ ] **Step 5: Regenerate, verify, and commit**

Run: `pnpm access:check && pnpm catalog:generate && pnpm catalog:check && pnpm --filter @hk-open-data/schemas test && pnpm --filter @hk-open-data/catalog build`

Expected: PASS with 521 catalogue resources and access data only on official entries.

```bash
git add scripts/catalog.py tests/catalog packages/schemas/src apps/catalog catalog/generated catalog/schemas/resource.schema.json
git commit -m "feat: project access recipes into the catalogue"
```

### Task 11: Add the bilingual catalogue access experience

**Files:**
- Create: `apps/catalog/src/components/AccessPanel.tsx`
- Create: `apps/catalog/src/components/AccessPanel.test.tsx`
- Modify: `apps/catalog/src/components/ResourceDetail.tsx`
- Modify: `apps/catalog/src/components/Filters.tsx`
- Modify: `apps/catalog/src/search.ts`
- Modify: `apps/catalog/src/search.test.ts`
- Modify: `apps/catalog/src/types.ts`
- Modify: `apps/catalog/src/i18n.ts`
- Modify: `apps/catalog/src/styles.css`
- Modify: `apps/catalog/src/App.test.tsx`
- Modify: `apps/catalog/src/test-fixtures.ts`
- Modify: `tests/browser/catalog.spec.ts`
- Modify: `tests/browser/accessibility.spec.ts`

**Interfaces:**
- Consumes: static `Resource.accessRecipe` with examples and effective verification status.
- Produces: an offline Access section and filters `Has executable recipe`, `Live verified`, and `No automated access` in English and Traditional Chinese.

- [ ] **Step 1: Write failing component and filter tests**

```typescript
it("shows copyable examples and the permission boundary without executing them", async () => {
  render(<AccessPanel locale="en" recipe={fixtureRecipe} />);
  expect(screen.getByText("Fixture tested")).toBeVisible();
  expect(screen.getByRole("tab", { name: "Python" })).toBeVisible();
  expect(screen.getByText(/does not grant permission/i)).toBeVisible();
  expect(global.fetch).not.toHaveBeenCalled();
});

it("filters resources by executable recipe", () => {
  expect(searchResources(resources, "", { access: "executable" })).toEqual([executable]);
});
```

- [ ] **Step 2: Run catalogue tests and verify failure**

Run: `pnpm --filter @hk-open-data/catalog test`

Expected: FAIL because `AccessPanel` and access filters do not exist.

- [ ] **Step 3: Implement bilingual status, parameters, evidence, and example tabs**

Render persisted status and effective status distinctly when evidence is stale. Show adapter, authentication, `checkedAt`, `validUntil`, parameters, media types, limitations, documentation link, and examples. Copy buttons use `navigator.clipboard.writeText` only after a click and announce success through an `aria-live` region.

- [ ] **Step 4: Add access filters without changing resource-type semantics**

```typescript
const accessMatch =
  !filters.access ||
  (filters.access === "executable" && resource.accessRecipe?.request !== null) ||
  (filters.access === "live" && resource.accessRecipe?.effectiveStatus === "live-verified") ||
  (filters.access === "none" && resource.accessRecipe?.request === null);
```

Keep the default visible count at ten and reset it to ten when the access filter changes.

- [ ] **Step 5: Verify visual behavior and accessibility and commit**

Run: `pnpm --filter @hk-open-data/catalog test && pnpm --filter @hk-open-data/catalog typecheck && pnpm --filter @hk-open-data/catalog build && pnpm exec playwright test tests/browser/catalog.spec.ts tests/browser/accessibility.spec.ts`

Expected: PASS at desktop and mobile widths with keyboard-accessible tabs, copy controls, filters, and provider links.

```bash
git add apps/catalog/src tests/browser
git commit -m "feat: show source access guidance in catalogue"
```

### Task 12: Add read-only REST recipe endpoints

**Files:**
- Create: `services/api/src/access-registry.ts`
- Create: `services/api/src/routes/access-recipes.ts`
- Create: `services/api/src/app.access.test.ts`
- Modify: `services/api/src/app.ts`
- Modify: `services/api/src/domain.ts`
- Modify: `services/api/src/server.ts`
- Modify: `services/api/src/openapi-contract.test.ts`
- Modify: `packages/schemas/contracts/openapi.json`
- Modify: `packages/schemas/scripts/sync-contracts.mjs`
- Modify: `packages/schemas/contracts/contract-manifest.json`
- Modify: `infra/docker/api.Dockerfile`

**Interfaces:**
- Consumes: validated `access/generated/recipes.json` at API startup.
- Produces: `GET /v1/access-recipes` and `GET /v1/access-recipes/{source_reference}` with adapter, status, authentication, freshness filters, examples, verification summary, and limitations.

- [ ] **Step 1: Write failing API route tests**

```typescript
it("lists public access recipes without provider traffic or credentials", async () => {
  const response = await app().inject({ method: "GET", url: "/v1/access-recipes?status=fixture-tested" });
  expect(response.statusCode).toBe(200);
  expect(response.json().items[0]).toMatchObject({ source_reference: "HKAPI-001", status: "fixture-tested" });
  expect(JSON.stringify(response.json())).not.toMatch(/authorization|cookie|secret-token/i);
});

it("returns 404 for an unknown recipe", async () => {
  const response = await app().inject({ method: "GET", url: "/v1/access-recipes/HKAPI-999" });
  expect(response.statusCode).toBe(404);
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run: `pnpm --filter @hk-open-data/api test -- app.access.test.ts`

Expected: FAIL with route not found.

- [ ] **Step 3: Implement immutable registry loading and routes**

```typescript
export function registerAccessRecipeRoutes(app: FastifyInstance, registry: AccessRegistry): void {
  app.get("/v1/access-recipes", async (request) => registry.list(accessRecipeQuery.parse(request.query)));
  app.get("/v1/access-recipes/:source_reference", async (request) => {
    const { source_reference } = accessRecipeParams.parse(request.params);
    const recipe = registry.get(source_reference);
    if (recipe === undefined) throw notFound("Access recipe");
    return recipe;
  });
}
```

Load once at startup, validate with `accessRecipeIndexSchema`, preserve deterministic numeric order, and use the existing page response and safe error envelope. No route calls `fetch` or worker execution.

- [ ] **Step 4: Extend OpenAPI and Docker inputs**

Add both paths and `AccessRecipe`, `AccessRecipePage`, and `VerificationSummary` schemas. Update the expected operation count from 24 to 26, regenerate the contract manifest, and copy `access/generated` into the API image.

- [ ] **Step 5: Verify and commit**

Run: `pnpm --filter @hk-open-data/api test -- app.access.test.ts openapi-contract.test.ts && pnpm --filter @hk-open-data/api typecheck && node packages/schemas/scripts/sync-contracts.mjs && node scripts/check-contract-drift.mjs`

Expected: PASS with schema-valid list/detail responses and no provider-fetch route.

```bash
git add services/api packages/schemas/contracts packages/schemas/scripts infra/docker/api.Dockerfile
git commit -m "feat: expose read-only access recipe API"
```

### Task 13: Add Python and TypeScript SDK recipe methods

**Files:**
- Create: `packages/sdk-python/src/hk_data_sdk/access.py`
- Create: `tests/access/test_python_sdk_access.py`
- Modify: `packages/sdk-python/src/hk_data_sdk/client.py`
- Modify: `packages/sdk-python/src/hk_data_sdk/models.py`
- Modify: `packages/sdk-python/src/hk_data_sdk/__init__.py`
- Modify: `packages/sdk-typescript/src/types.ts`
- Modify: `packages/sdk-typescript/src/client.ts`
- Modify: `packages/sdk-typescript/src/client.test.ts`

**Interfaces:**
- Consumes: REST recipe endpoints.
- Produces: Python `list_access_recipes`, `get_access_recipe`, `get_access_example`; TypeScript `listAccessRecipes`, `getAccessRecipe`, `getAccessExample`.

- [ ] **Step 1: Write failing SDK tests**

```python
def test_python_sdk_reads_recipe_and_example() -> None:
    client = HKDataClient(base_url="https://api.example/v1", transport=recipe_transport())
    recipe = client.get_access_recipe("HKAPI-001")
    assert recipe["source_reference"] == "HKAPI-001"
    assert client.get_access_example("HKAPI-001", "python").startswith("import httpx")
```

```typescript
it("encodes recipe references and returns a typed example", async () => {
  const recipe = await client.getAccessRecipe("HKAPI-001");
  expect(recipe.source_reference).toBe("HKAPI-001");
  expect(await client.getAccessExample("HKAPI-001", "typescript")).toContain("fetch(");
});
```

- [ ] **Step 2: Run both SDK tests and verify failure**

Run: `uv run pytest tests/access/test_python_sdk_access.py -q && pnpm --filter @hk-open-data/sdk-typescript test`

Expected: FAIL because the recipe methods and types are absent.

- [ ] **Step 3: Implement thin REST client methods**

Use the existing `_request`/`#request` transports and error envelopes. `getAccessExample` reads the requested language from the recipe response's `examples` object; it does not call a provider or execute the code.

- [ ] **Step 4: Verify types, behavior, and commit**

Run: `uv run pytest tests/access/test_python_sdk_access.py -q && uv run mypy packages/sdk-python/src && pnpm --filter @hk-open-data/sdk-typescript test && pnpm --filter @hk-open-data/sdk-typescript typecheck`

Expected: PASS with invalid languages rejected locally and unknown references represented by the common API error.

```bash
git add packages/sdk-python packages/sdk-typescript tests/access/test_python_sdk_access.py
git commit -m "feat: add access recipes to project SDKs"
```

### Task 14: Add two read-only MCP recipe tools and bump the contract

**Files:**
- Create: `services/mcp/src/tools/access-recipes.ts`
- Modify: `services/mcp/src/server.ts`
- Modify: `services/mcp/src/client.ts`
- Modify: `services/mcp/src/schemas.ts`
- Modify: `services/mcp/src/tools.test.ts`
- Modify: `services/mcp/src/client.test.ts`
- Modify: `services/mcp/src/evaluations.test.ts`
- Modify: `services/mcp/evaluations/read-only.xml`
- Modify: `services/mcp/src/fingerprint.ts`
- Modify: `packages/schemas/contracts/mcp-tool-contract.md`
- Modify: `packages/schemas/contracts/mcp_allowlist.schema.json`
- Modify: `packages/schemas/contracts/contract-manifest.json`
- Modify: `packages/schemas/scripts/sync-contracts.mjs`
- Modify: `services/worker/hk_data_worker/models.py`

**Interfaces:**
- Consumes: the two REST recipe endpoints.
- Produces: MCP tools `access_recipes_list` and `access_recipe_get`; contract version `2026-09-01.v1`; a newly pinned exact 13-tool fingerprint.

- [ ] **Step 1: Write failing MCP contract and safety tests**

```typescript
it("registers thirteen exact read-only tools", async () => {
  expect(NORMATIVE_TOOL_NAMES).toEqual([
    "sources_list", "source_get", "source_records_query", "source_record_get",
    "events_query", "event_get", "monitor_targets_list", "monitor_target_get",
    "incidents_list", "incident_get", "status_summary",
    "access_recipes_list", "access_recipe_get",
  ]);
});

it("recipe tools cannot execute providers", async () => {
  const result = await callTool("access_recipe_get", { source_reference: "HKAPI-001" });
  expect(result).not.toHaveProperty("provider_response_body");
  expect(fetcher).toHaveBeenCalledWith(expect.stringContaining("/v1/access-recipes/HKAPI-001"), expect.anything());
});
```

- [ ] **Step 2: Run MCP tests and verify failure**

Run: `pnpm --filter @hk-open-data/mcp test`

Expected: FAIL because only 11 normative tools exist.

- [ ] **Step 3: Register exact schemas, descriptions, and REST routes**

```typescript
access_recipes_list: z.object({
  adapter: z.string().optional(),
  status: accessStatusSchema.optional(),
  authentication: z.string().optional(),
  freshness: z.enum(["current", "stale", "never"]).optional(),
  ...page,
}).strict(),
access_recipe_get: z.object({ source_reference: z.string().regex(/^HKAPI-[0-9]{3}$/) }).strict(),
```

Set `readOnlyHint: true`, `destructiveHint: false`, `idempotentHint: true`, and `openWorldHint: false`. Route only to `access-recipes`; do not add an execution route or arbitrary URL input.

- [ ] **Step 4: Bump and pin the contract intentionally**

Change contract version strings to `2026-09-01.v1`, document all 13 tools in exact server order, regenerate the allowlist hash and contract manifest, and replace `PINNED_TOOL_FINGERPRINT` with the value produced by the test helper after reviewing the schema diff.

- [ ] **Step 5: Verify MCP security and commit**

Run: `pnpm --filter @hk-open-data/mcp test && pnpm --filter @hk-open-data/mcp typecheck && pnpm --filter @hk-open-data/mcp build && uv run pytest tests/security/test_mcp_read_only.py -q && node scripts/check-contract-drift.mjs`

Expected: PASS with exactly 13 read-only tools and no provider-network capability.

```bash
git add services/mcp packages/schemas/contracts packages/schemas/scripts services/worker/hk_data_worker/models.py
git commit -m "feat: add read-only access recipe MCP tools"
```

### Task 15: Run opt-in live verification for anonymous official recipes

**Files:**
- Create: `tests/access/test_live_smoke.py`
- Create or modify: `access/verification/hkapi-NNN.json` only for executed anonymous recipes
- Modify: `access/generated/recipes.json`
- Modify: `access/generated/coverage.json`
- Modify: `docs/access/source-status.md`
- Modify: `RELEASE_EVIDENCE.md`

**Interfaces:**
- Consumes: all anonymous executable official recipes and the user-approved low-volume live-smoke boundary.
- Produces: current metadata-only verification evidence and truthful effective statuses.

- [ ] **Step 1: Add a network-opt-in live test gate**

```python
pytestmark = pytest.mark.skipif(
    os.environ.get("RUN_LIVE_ACCESS_TESTS") != "1",
    reason="set RUN_LIVE_ACCESS_TESTS=1 for bounded official endpoint checks",
)

def test_all_anonymous_recipes_plan_fetch_parse_and_normalize() -> None:
    results = verify_all_anonymous(concurrency=1)
    assert all(result.source_reference.startswith("HKAPI-") for result in results)
```

- [ ] **Step 2: Prove default test runs make no provider requests**

Run: `uv run pytest tests/access/test_live_smoke.py -q`

Expected: SKIP with the explicit opt-in reason.

- [ ] **Step 3: Execute sequential bounded checks and preserve failures truthfully**

Run: `RUN_LIVE_ACCESS_TESTS=1 uv run pytest tests/access/test_live_smoke.py -q -s`

Expected: Each attempted source produces a validated evidence record containing status/schema/hash/timestamp/parse outcomes only. A failed, gated, rate-limited, or changed source remains `fixture-tested`, `credential-required`, `blocked`, or `unavailable`; it is never promoted solely because the endpoint returned HTTP 200.

- [ ] **Step 4: Secret-scan and regenerate effective statuses**

Run: `node scripts/check-secrets.mjs && uv run python scripts/access.py generate && uv run python scripts/access.py check`

Expected: PASS; every `live-verified` recipe has unexpired matching evidence, and committed evidence contains no response bodies or credential material.

- [ ] **Step 5: Record exact observed counts and commit**

Update `RELEASE_EVIDENCE.md` and `docs/access/source-status.md` from `access/generated/coverage.json`, including attempted, live-verified, fixture-tested, credential-required, manual-only, blocked, unavailable, and unclassified counts.

```bash
git add access/verification access/generated docs/access/source-status.md RELEASE_EVIDENCE.md tests/access/test_live_smoke.py
git commit -m "test: record official source compatibility evidence"
```

### Task 16: Document public usage and legal boundaries

**Files:**
- Modify: `README.md`
- Modify: `README.zh-HK.md`
- Modify: `docs/getting-started/runtime.md`
- Modify: `docs/getting-started/runtime.zh-HK.md`
- Create: `docs/getting-started/access-recipes.md`
- Create: `docs/getting-started/access-recipes.zh-HK.md`
- Modify: `docs/architecture/OVERVIEW.md`
- Modify: `docs/architecture/OPEN_SOURCE_DESIGN.md`
- Modify: `packages/connectors/README.md`
- Create: `packages/sdk-python/README.md`
- Create: `packages/sdk-typescript/README.md`
- Modify: `services/api/README.md`
- Modify: `services/mcp/README.md`
- Modify: `CHANGELOG.md`
- Modify: `tests/repository/public-language.test.mjs`
- Modify: `tests/repository/public-boundary.test.mjs`
- Modify: `tests/repository/notices.test.mjs`

**Interfaces:**
- Consumes: verified commands, derived coverage counts, API/MCP tool names, and existing governance notices.
- Produces: bilingual copy-and-run quick starts and public claims bounded by evidence.

- [ ] **Step 1: Write failing public-documentation assertions**

```javascript
test("README explains executable guidance without implying provider permission", () => {
  assert.match(readme, /hkdata recipe HKAPI-001/);
  assert.match(readme, /hkdata verify HKAPI-001/);
  assert.doesNotMatch(readme, /all connectors are live|approved by providers/i);
  assert.match(readme, /does not grant.*commercial use.*caching.*redistribution/is);
});
```

- [ ] **Step 2: Run repository tests and verify failure**

Run: `node --test tests/repository/*.test.mjs`

Expected: FAIL until both language versions contain tested commands and the evidence boundary.

- [ ] **Step 3: Write the English and Traditional Chinese guides**

Document offline recipe/example lookup, the explicit network boundary for fetch/verify, `--allow-unverified`, credential environment variables, stable exit codes, generated examples, API routes, SDK methods, MCP tools, Docker profiles, evidence files, and how contributors update one source safely.

- [ ] **Step 4: Keep public claims derived and qualified**

Use exact counts from generated coverage. Describe the runtime as providing tested recipes only for effective `live-verified` or `fixture-tested` entries. State that linked data remains governed by providers and that technical success does not grant permission, endorsement, commercial-use rights, caching rights, or redistribution rights.

- [ ] **Step 5: Verify documentation and commit**

Run: `node --test tests/repository/*.test.mjs && node scripts/check-public-boundary.mjs && node scripts/check-secrets.mjs && git diff --check`

Expected: PASS with no private workspace paths, internal planning language, secrets, unsupported compatibility claims, or missing legal boundary.

```bash
git add README.md README.zh-HK.md docs packages/connectors/README.md packages/sdk-python/README.md packages/sdk-typescript/README.md services/api/README.md services/mcp/README.md CHANGELOG.md tests/repository
git commit -m "docs: publish source access toolkit guidance"
```

### Task 17: Complete end-to-end qualification and release evidence

**Files:**
- Modify: `scripts/run-integrated-tests.sh`
- Modify: `scripts/smoke-local.mjs`
- Modify: `tests/integration/test_compose_config.py`
- Modify: `tests/browser/catalog.spec.ts`
- Modify: `RELEASE_EVIDENCE.md`
- Modify: `docs/release/PRE_PUBLICATION_AUDIT.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Consumes: all recipe, adapter, CLI, runtime, catalogue, API, SDK, MCP, documentation, and Docker deliverables.
- Produces: reproducible release qualification and an evidence-bounded publication decision.

- [ ] **Step 1: Add failing integrated assertions for all projections**

```python
def test_recipe_version_matches_across_generated_catalogue_api_and_mcp(runtime: Runtime) -> None:
    expected = generated_recipe("HKAPI-001")
    assert runtime.catalogue_recipe("HKAPI-001")["recipeSha256"] == expected["recipeSha256"]
    assert runtime.api_recipe("HKAPI-001")["recipe_sha256"] == expected["recipeSha256"]
    assert runtime.mcp_recipe("HKAPI-001")["data"]["item"]["recipe_sha256"] == expected["recipeSha256"]
```

- [ ] **Step 2: Run focused integration tests and verify failure before harness changes**

Run: `RUN_DOCKER_TESTS=1 uv run pytest tests/integration/test_compose_config.py -q`

Expected: FAIL because integrated access-recipe projection checks are not wired into the harness.

- [ ] **Step 3: Extend local smoke and Compose checks**

Assert plain `docker compose up` starts only the catalogue and performs no provider request. In `observe`, query both API recipe endpoints and both MCP recipe tools without running fetch. In `fabric`, execute only a synthetic fixture-backed connector during automated qualification; live providers remain confined to the opt-in Task 15 command.

- [ ] **Step 4: Run the complete repository verification suite**

Run: `make verify-all`

Expected: PASS for catalogue validation, access validation, unit tests, contract tests, typechecks, builds, browser tests, secret scanning, public-boundary checks, and repository-language checks.

- [ ] **Step 5: Run integrated Docker qualification**

Run: `make verify-integrated`

Expected: PASS with catalogue, observe, and fabric profile boundaries intact; API/MCP recipe hashes match committed generated data.

- [ ] **Step 6: Review the final diff and generated-state cleanliness**

Run: `git diff --check && pnpm access:check && pnpm catalog:check && git status --short`

Expected: no whitespace errors, no generated drift, no unexpected response bodies, and only intended release-evidence/documentation changes unstaged.

- [ ] **Step 7: Record qualification and commit**

Record commands, timestamps, exact test totals, Docker versions, coverage counts, MCP fingerprint, live-check boundary, failures retained as non-live statuses, and remaining provider-controlled limitations.

```bash
git add scripts tests/integration tests/browser RELEASE_EVIDENCE.md docs/release/PRE_PUBLICATION_AUDIT.md CHANGELOG.md
git commit -m "chore: qualify source access toolkit release"
```

---

## Final Acceptance Checklist

- [ ] `access/generated/coverage.json` reports 265 official recipes and zero unclassified records.
- [ ] Every executable recipe has a schema-valid request, three syntactically valid generated examples, and a hashed synthetic fixture.
- [ ] Every `live-verified` recipe has unexpired evidence whose recipe SHA-256 matches the current recipe.
- [ ] The 22 current runtime sources dispatch by source-specific recipe rather than source-group response assumptions.
- [ ] CLI, catalogue, REST API, Python SDK, TypeScript SDK, and MCP expose the same recipe version, hash, effective status, limitations, and examples.
- [ ] Plain catalogue startup and static-site interaction perform no provider traffic.
- [ ] MCP exposes exactly 13 reviewed read-only tools and no provider execution capability.
- [ ] Credential values and live provider bodies are absent from Git history for this branch.
- [ ] Public documentation distinguishes technical evidence from provider authorization, endorsement, and usage rights.
- [ ] `make verify-all` and `make verify-integrated` pass on the release revision.
