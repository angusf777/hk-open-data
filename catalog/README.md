# Resource catalogue

This directory contains the public metadata behind the HK Open Data catalogue:

- `official/`: 265 resources published by Hong Kong public authorities
- `external/`: 145 third-party resources that may be useful in Hong Kong
- `mcp/`: 111 community MCP projects for evaluation
- `schemas/`: the machine-enforced resource and aggregate contracts
- `vocabularies/`: controlled category and protocol values
- `generated/`: deterministic JSON derived from the YAML source records

Each resource has a stable namespaced ID and its original source reference. English and
Traditional Chinese fields are required for published records. A `seeded` translation status means
that project maintainers have not yet recorded a human language review.

## Evidence, not endorsement

The catalogue records metadata and review state. Inclusion does not mean that this project operates,
endorses, secures or guarantees a provider, API, dataset or MCP server. It does not copy provider
data, grant access, or confirm that an endpoint is currently available.

`termsEvidence` is a structured research aid, not legal advice or permission. It does not determine
whether commercial use, caching, redistribution, attribution, personal-data processing or any other
activity is lawful. Check the provider's current terms, policies, licences and applicable law before
use. Upstream wording and law control if this catalogue is incomplete, outdated or wrong.

## Rebuild and verify

The public YAML records are authoritative for this repository. Rebuild and compare the generated
JSON with:

```bash
uv sync --locked
uv run python scripts/catalog.py validate
uv run python scripts/catalog.py generate
uv run python scripts/catalog.py check
```

The private research indexes used for the initial import are intentionally not included. The import
tool accepts explicit CSV paths and writes only normalized public metadata:

```bash
uv run python scripts/import_catalogue.py \
  --official /path/to/official.csv \
  --external /path/to/external.csv \
  --mcp /path/to/mcp.csv \
  --output catalog
```

Report inaccurate metadata, rights evidence or unsafe links through the correction process described
in [`docs/governance/CORRECTIONS_AND_TAKEDOWNS.md`](../docs/governance/CORRECTIONS_AND_TAKEDOWNS.md).
