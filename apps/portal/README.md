# Public portal

Bilingual, responsive public status and source/incident interface. Anonymous views contain only
reviewed public projections and the independent-monitoring limitation. A last complete reviewed
snapshot is stored atomically and served with its timestamp when the live API is unavailable.

```sh
pnpm --filter @hk-open-data/portal dev
pnpm --filter @hk-open-data/portal test
pnpm --filter @hk-open-data/portal build
```

Core 1440/1024/720/390 px flows and serious axe violations are checked by the root Playwright suite.
