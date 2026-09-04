# Catalogue quick start

The catalogue is the default product surface. It is static, bilingual, reproducible, and makes no
provider requests while loading or filtering records.

## Requirements

- Git
- Node.js 22 or newer
- pnpm 10
- Python 3.12 or newer
- uv

Docker is not required.

## Install and build

```bash
git clone https://github.com/angusf777/hk-open-data.git
cd hk-open-data
pnpm install --frozen-lockfile && uv sync --frozen --all-packages --all-groups
make catalogue
```

`make catalogue` validates and regenerates the deterministic catalogue JSON, then writes the static
site to `apps/catalog/dist/`. Serve that directory over HTTP or start the development server:

```bash
pnpm --filter @hk-open-data/catalog dev
```

## Browse provider files and API endpoints

Open `/provider-resources/` from the catalogue's toolkit section to search the exact files and API
endpoints mapped from reviewed DATA.GOV.HK datasets. You can filter by URL status, resource type,
payload evidence or format, then generate bounded cURL, Python, Node or `hkdata` commands for a
direct resource that passed its bounded payload check.

The browser lazily reads the repository-generated `data-gov-resources.json` only after you open
that page. Search, filters and command generation run in your browser and do not contact a listed
provider. A provider request occurs only if you explicitly run a generated command or open a ready
HTTPS resource link. HTTP-only and invalid URLs do not receive executable commands.

Every mapped dataset has a permanent `/datasets/{dataset-id}/` page. Catalogue categories also
have permanent routes, and both catalogue and provider-resource filters are reflected in the URL
so a view can be bookmarked or shared. The main catalogue can export its current results as JSON
or spreadsheet-safe CSV.

The provider browser offers zero-install JSON, CSV, and SQLite downloads. These snapshots contain
project-authored metadata, provider URLs, and technical evidence—not provider dataset payloads.
See [Use the metadata snapshots](metadata-downloads.md) for checksum, CSV, and SQLite examples.

## Verify a checkout

```bash
make verify-catalogue
make verify-site
make test-repository
make check-boundary
```

The browser tests assert that initial load, search, filtering, language changes, detail routes and
provider-resource browsing do not contact provider hosts.

## Edit a resource

1. Choose the collection under `catalog/official`, `catalog/external`, or `catalog/mcp`.
2. Edit one namespaced YAML record and keep its stable `id` and `sourceReference`.
3. Link authoritative evidence, use factual language, and retain `translationStatus: seeded` until a
   fluent human review is recorded.
4. Run `uv run python scripts/catalog.py validate`.
5. Run `uv run python scripts/catalog.py generate` and commit the changed generated JSON.
6. Run `node scripts/update-readme-stats.mjs` if collection totals changed.
7. Run the verification commands above.

Do not copy provider datasets, substantial documentation, credentials, personal data, internal
research files, or private correspondence into the catalogue. See
[Source terms and permissions](../governance/SOURCE_RIGHTS.md) before changing a terms-review state.
