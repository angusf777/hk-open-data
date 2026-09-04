# Company information: registered place of business

Call the Companies Registry example for a registered non-Hong Kong company.

## Run it

From the repository root:

```bash
uv run --project packages/sdk-python hkdata fetch-resource HKAPI-147 8ee7f555-0f8c-440a-b816-ea58e7a8dc1f --dataset hk-cr-crdata-list-addr --max-bytes 26214400 --output company-place-of-business.json
```

Equivalent bounded cURL request:

```bash
curl --fail-with-body --max-time 30 --proto '=https' --max-filesize 26214400 --remove-on-error --no-clobber --output company-place-of-business.json 'https://data.cr.gov.hk/cr/api/api/v1/api_builder/json/foreign/search?query[0][key1]=Brn&query[0][key2]=equal&query[0][key3]=75698252'
```

## What was verified

- Catalogue source: `HKAPI-147`
- DATA.GOV.HK dataset: [`hk-cr-crdata-list-addr`](https://angusf777.github.io/hk-open-data/datasets/hk-cr-crdata-list-addr/)
- Exact resource: `8ee7f555-0f8c-440a-b816-ea58e7a8dc1f`
- Resource type: `api`; declared format: `API`
- Latest bounded attempt: `2026-09-04T03:20:20.416715Z`; HTTP `200`;
  media type `application/json`
- Evidence sample: `566` bytes; SHA-256 `eda255793ef3ed24ca25873d097597f637c8c054376c99fa215522bd2f6a0c55`

The check read only a bounded sample. It proves that this exact URL returned a non-empty successful
response at the recorded time; it does not guarantee later availability, completeness, or fitness.

## Before using the data

Review the provider's current dataset and platform terms before commercial use, caching, scraping,
or redistribution. This technical example does not grant rights in provider data.
