# Python SDK and source-access CLI

This package provides the `HKDataClient` for a self-hosted HK Open Data REST service and the
`hkdata` command for local recipe lookup, bounded source requests and metadata-only verification.
Python 3.12 or later is required.

From the repository workspace:

```bash
uv sync --frozen --all-groups
uv run --project packages/sdk-python hkdata recipe HKAPI-001
uv run --project packages/sdk-python hkdata example HKAPI-001 python
uv run --project packages/sdk-python hkdata verify HKAPI-001
uv run --project packages/sdk-python hkdata resources HKAPI-030
```

Run `hkdata` inside the repository checkout. For an editable installation invoked from another
directory, set `HK_OPEN_DATA_REPOSITORY=/absolute/path/to/hk-open-data` so the CLI can find the
versioned recipe and provider-resource registries.

Recipe and example lookup is offline. `fetch` and `verify` can contact a listed source and must be
run deliberately after reviewing its current terms. See the bilingual
[source-access guide](../../docs/getting-started/access-recipes.md) for parameters, status labels,
exit codes, evidence and permission boundaries.

## REST client

Use HTTPS for a remotely reachable self-hosted service:

```python
from hk_data_sdk import HKDataClient

with HKDataClient(base_url="https://toolkit.example/v1") as client:
    page = client.list_access_recipes(status="live-verified", limit=10)
    recipe = client.get_access_recipe("HKAPI-001")
    example = client.get_access_example("HKAPI-001", "python")
    resources = client.list_access_resources(source_reference="HKAPI-030", limit=10)
    resource = client.get_access_resource(
        "nlb-bus-nlb-bus-service-v2",
        "96c5e827-3d3a-4110-8cd2-e7c80cd562bc",
    )
```

The access methods are:

- `list_access_recipes(**query)` for a cursor page, with API-supported filters;
- `get_access_recipe(source_reference)` for one complete recipe; and
- `get_access_example(source_reference, language)` for `curl`, `python`, or `typescript` code.
- `list_access_resources(**query)` for exact mapped provider URLs and templates; and
- `get_access_resource(dataset_id, resource_id)` for one resource and its CLI usage.

These SDK methods read the self-hosted REST registry. They do not execute a listed source. Use the
CLI when you intentionally want to run a recipe.

## Test the package

```bash
uv run pytest packages/sdk-python/tests tests/access/test_python_sdk_access.py -q
uv run mypy packages/sdk-python/src
```

Technical compatibility does not grant commercial-use, caching, redistribution, scraping or
other usage rights in a listed source. Review current source terms before use.
