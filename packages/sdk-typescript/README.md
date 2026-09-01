# TypeScript SDK

This package provides the typed `HKDataClient` for a self-hosted HK Open Data REST service. It can
read catalogue data, runtime status and the same source-access recipes shown in the public
catalogue.

```typescript
import { HKDataClient } from "@hk-open-data/sdk-typescript";

const client = new HKDataClient({ baseUrl: "https://toolkit.example/v1" });
const page = await client.listAccessRecipes({ status: "live-verified", limit: 10 });
const recipe = await client.getAccessRecipe("HKAPI-001");
const example = await client.getAccessExample("HKAPI-001", "typescript");
```

The access methods are:

- `listAccessRecipes(query)` for a cursor page and API-supported filters;
- `getAccessRecipe(sourceReference)` for one complete recipe; and
- `getAccessExample(sourceReference, language)` for `curl`, `python`, or `typescript` code.

These methods read the self-hosted REST registry and do not execute a listed source. For offline
lookup or a deliberate bounded request, use `hkdata recipe HKAPI-001`,
`hkdata example HKAPI-001 python`, or `hkdata verify HKAPI-001` from the Python package. The
bilingual [source-access guide](../../docs/getting-started/access-recipes.md) explains the network
boundary, status labels and evidence.

```bash
pnpm --filter @hk-open-data/sdk-typescript test
pnpm --filter @hk-open-data/sdk-typescript typecheck
pnpm --filter @hk-open-data/sdk-typescript build
```

Technical compatibility does not grant commercial-use, caching, redistribution, scraping or
other usage rights in a listed source. Review current source terms before use.
