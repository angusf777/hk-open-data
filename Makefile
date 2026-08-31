.PHONY: catalogue verify-catalogue verify-site check-boundary test-repository

catalogue:
	uv run python scripts/catalog.py generate
	pnpm --filter @hk-open-data/catalog build

verify-catalogue:
	uv run pytest tests/catalog -q
	uv run python scripts/catalog.py check
	node scripts/update-readme-stats.mjs --check

verify-site:
	pnpm --filter @hk-open-data/catalog test
	pnpm --filter @hk-open-data/catalog typecheck
	pnpm --filter @hk-open-data/catalog build
	pnpm exec playwright test tests/browser/catalog.spec.ts tests/browser/accessibility.spec.ts

check-boundary:
	node scripts/check-public-boundary.mjs

test-repository:
	node --test tests/repository/*.test.mjs
