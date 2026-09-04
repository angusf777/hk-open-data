# Use the metadata snapshots

The live catalogue publishes zero-install snapshots for analysis, scripts, spreadsheets, and local
SQL. They contain project-authored catalogue records, provider URLs, mapped dataset metadata, and
bounded technical evidence. They do **not** contain provider dataset payloads.

## Download and check

Open the [download directory](https://angusf777.github.io/hk-open-data/downloads/README.txt) or run:

```bash
mkdir hk-open-data-metadata && cd hk-open-data-metadata
curl --fail --remote-name-all \
  https://angusf777.github.io/hk-open-data/downloads/{sources.csv,datasets.csv,provider-resources.csv,hk-open-data.sqlite,SHA256SUMS}
shasum -a 256 -c SHA256SUMS --ignore-missing
```

`SHA256SUMS` covers every file in the published snapshot. Release assets also contain a versioned
metadata archive and an outer release checksum file.

## Query SQLite

```bash
sqlite3 hk-open-data.sqlite '.tables'
sqlite3 -header -column hk-open-data.sqlite \
  "select source_reference, name_en, landing_url from catalogue_sources where categories like '%transportation%' limit 10;"
sqlite3 -header -column hk-open-data.sqlite \
  "select dataset_id, name, format, url_template from provider_resources where verification_status = 'live-verified' limit 10;"
```

The database contains `metadata`, `catalogue_sources`, `datasets`, and `provider_resources`. JSON
arrays in CSV and SQLite fields preserve values such as categories, formats, parameters, and source
references without inventing a lossy delimiter format.

## Read CSV with Python

```python
import csv

with open("provider-resources.csv", encoding="utf-8", newline="") as source:
    verified = [
        row for row in csv.DictReader(source)
        if row["verification_status"] == "live-verified"
    ]

print(f"{len(verified)} exact resources have current bounded payload evidence")
```

## Regenerate from a checkout

```bash
pnpm snapshots:generate
```

The generator rejects evidence that does not match the exact provider-resource inventory hash.
The static-site build runs the same generator automatically.

## Rights and evidence boundary

Snapshot inclusion, a provider URL, and a successful technical check do not grant permission for
commercial use, caching, scraping, redistribution, personal-data processing, or any other proposed
use. Review the provider's current source-specific and platform-wide terms and applicable law. The
project snapshot can also become stale after its recorded check date.
