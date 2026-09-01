.PHONY: catalogue verify-catalogue verify-access verify-site verify-runtime verify-integrated verify-all \
	check-boundary check-secrets test-repository runtime-catalogue runtime-observe runtime-fabric \
	runtime-stop hkdata

catalogue:
	uv run python scripts/catalog.py generate
	pnpm --filter @hk-open-data/catalog build

hkdata:
	uv run --project packages/sdk-python hkdata --help

verify-catalogue:
	uv run pytest tests/catalog -q
	uv run python scripts/catalog.py check
	node scripts/update-readme-stats.mjs --check

verify-access:
	uv run pytest tests/access -q
	uv run python scripts/access.py check

verify-site:
	pnpm --filter @hk-open-data/catalog test
	pnpm --filter @hk-open-data/catalog typecheck
	pnpm --filter @hk-open-data/catalog build
	pnpm exec playwright test tests/browser/catalog.spec.ts tests/browser/accessibility.spec.ts

check-boundary:
	node scripts/check-public-boundary.mjs

test-repository:
	node --test tests/repository/*.test.mjs

check-secrets:
	node scripts/check-secrets.mjs

verify-runtime:
	node scripts/check-contract-drift.mjs
	pnpm -r --if-present test
	pnpm -r --if-present typecheck
	pnpm -r --if-present build
	uv run ruff check scripts services tests packages/sdk-python/src
	uv run mypy services/worker packages/sdk-python/src
	uv run pytest -q
	node scripts/check-secrets.mjs

verify-integrated:
	RUN_DOCKER_TESTS=1 uv run pytest tests/integration/test_compose_config.py -q

verify-all: verify-catalogue verify-access verify-site verify-runtime check-boundary check-secrets test-repository

runtime-catalogue:
	docker compose up --build --detach --wait

runtime-observe:
	@test -f .env || (echo "Create an ignored .env from .env.example and set runtime secrets." >&2; exit 2)
	HKOD_PROFILE=observe docker compose --profile observe up --build --detach --wait

runtime-fabric:
	@test -f .env || (echo "Create an ignored .env from .env.example and set runtime and object-store secrets." >&2; exit 2)
	HKOD_PROFILE=fabric docker compose --profile fabric up --build --detach --wait

runtime-stop:
	docker compose --profile observe --profile fabric down --remove-orphans
