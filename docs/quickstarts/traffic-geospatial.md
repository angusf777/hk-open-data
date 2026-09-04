# Geospatial data: traffic census cordons

Download Transport Department traffic-census cordon geometry in GML.

## Run it

From the repository root:

```bash
uv run --project packages/sdk-python hkdata fetch-resource HKAPI-067 01d7163f-4740-4b12-97c0-8ebedcd0b72c --dataset hk-td-tis_7-traffic-flow-census --max-bytes 26214400 --output traffic-census-cordons.gml
```

Equivalent bounded cURL request:

```bash
curl --fail-with-body --max-time 30 --proto '=https' --max-filesize 26214400 --remove-on-error --no-clobber --output traffic-census-cordons.gml https://static.data.gov.hk/td/traffic-flow-census/ATC_CORDON_LINE.gml
```

## What was verified

- Catalogue source: `HKAPI-067`
- DATA.GOV.HK dataset: [`hk-td-tis_7-traffic-flow-census`](https://angusf777.github.io/hk-open-data/datasets/hk-td-tis_7-traffic-flow-census/)
- Exact resource: `01d7163f-4740-4b12-97c0-8ebedcd0b72c`
- Resource type: `file`; declared format: `GML`
- Latest bounded attempt: `2026-09-04T03:20:20.416715Z`; HTTP `206`;
  media type `text/gml`
- Evidence sample: `4096` bytes; SHA-256 `f5c1fc91244a552812b53fa7276f3206aab46c568fd33fdb69ac6fa5a311e4f6`

The check read only a bounded sample. It proves that this exact URL returned a non-empty successful
response at the recorded time; it does not guarantee later availability, completeness, or fitness.

## Before using the data

Review the provider's current dataset and platform terms before commercial use, caching, scraping,
or redistribution. This technical example does not grant rights in provider data.
