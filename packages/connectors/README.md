# Source connectors

The toolkit uses one connector per explicitly enabled source family. A connector runs the bounded
request described by that source's versioned recipe, normalizes the supported response shape, and
records timestamps, schema fingerprints and technical evidence. Synthetic fixtures test every
executable recipe without contacting a listed source.

All 265 official catalogue sources have an entry under `access/recipes/official/`. The current
breakdown is 227 executable recipes and 38 source-specific manual guides. The 190 DATA.GOV.HK
recipes resolve to 5,862 current provider resources in `access/generated/data-gov-resources.json`;
a 3 September 2026 bounded run sampled a working resource for 310 of 350 mapped datasets. A manual guide is a
deliberate boundary: it gives the official documentation, reason and next step instead of guessing
an endpoint or request shape.

Connectors remain inactive until the person running the toolkit enables a source. Activation and
technical success do not establish permission for commercial use, caching, redistribution,
scraping or another proposed use. See the
[source-access guide](../../docs/getting-started/access-recipes.md) before adding or running a
connector.
