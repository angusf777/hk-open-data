# Public transport routes: New Lantao Bus

Download the current New Lantao Bus route list as JSON.

## Run it

From the repository root:

```bash
uv run --project packages/sdk-python hkdata fetch-resource HKAPI-030 96c5e827-3d3a-4110-8cd2-e7c80cd562bc --dataset nlb-bus-nlb-bus-service-v2 --max-bytes 26214400 --output nlb-routes.json
```

Equivalent bounded cURL request:

```bash
curl --fail-with-body --max-time 30 --proto '=https' --max-filesize 26214400 --remove-on-error --no-clobber --output nlb-routes.json 'https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list'
```

## What was verified

- Catalogue source: `HKAPI-030`
- DATA.GOV.HK dataset: [`nlb-bus-nlb-bus-service-v2`](https://angusf777.github.io/hk-open-data/datasets/nlb-bus-nlb-bus-service-v2/)
- Exact resource: `96c5e827-3d3a-4110-8cd2-e7c80cd562bc`
- Resource type: `file`; declared format: `JSON`
- Latest bounded attempt: `2026-09-04T03:20:20.416715Z`; HTTP `200`;
  media type `application/json`
- Evidence sample: `4096` bytes; SHA-256 `5e8140b0968fb8e130809645a24e18e4afa7efb10e7adc611322c2d7a6a9d716`

The check read only a bounded sample. It proves that this exact URL returned a non-empty successful
response at the recorded time; it does not guarantee later availability, completeness, or fitness.

## Before using the data

Review the provider's current dataset and platform terms before commercial use, caching, scraping,
or redistribution. This technical example does not grant rights in provider data.
