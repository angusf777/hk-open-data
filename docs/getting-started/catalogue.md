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
pnpm install --frozen-lockfile && uv sync --frozen --all-groups
make catalogue
```

`make catalogue` validates and regenerates the deterministic catalogue JSON, then writes the static
site to `apps/catalog/dist/`. Serve that directory over HTTP or start the development server:

```bash
pnpm --filter @hk-open-data/catalog dev
```

## Verify a checkout

```bash
make verify-catalogue
make verify-site
make test-repository
make check-boundary
```

The browser tests assert that initial load, search, filtering, language changes, and detail routes
do not contact provider hosts.

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
[Source Rights and Evidence](../governance/SOURCE_RIGHTS.md) before changing a terms-evidence state.
