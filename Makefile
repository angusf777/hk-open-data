.PHONY: check-boundary test-repository

check-boundary:
	node scripts/check-public-boundary.mjs

test-repository:
	node --test tests/repository/*.test.mjs
