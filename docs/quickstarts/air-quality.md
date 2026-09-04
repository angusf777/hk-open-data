# Air quality: current AQHI by station

Download the current station-level Air Quality Health Index feed.

## Run it

From the repository root:

```bash
uv run --project packages/sdk-python hkdata fetch-resource HKAPI-101 33a48965-adef-4252-a90c-6e3bf9385aad --dataset hk-epd-airteam-current-aqhi-of-individual-air-quality-monitoring-stations --max-bytes 26214400 --output current-aqhi.xml
```

Equivalent bounded cURL request:

```bash
curl --fail-with-body --max-time 30 --proto '=https' --max-filesize 26214400 --remove-on-error --no-clobber --output current-aqhi.xml https://www.aqhi.gov.hk/epd/ddata/html/out/aqhi_ind_rss_Eng.xml
```

## What was verified

- Catalogue source: `HKAPI-101`
- DATA.GOV.HK dataset: [`hk-epd-airteam-current-aqhi-of-individual-air-quality-monitoring-stations`](https://angusf777.github.io/hk-open-data/datasets/hk-epd-airteam-current-aqhi-of-individual-air-quality-monitoring-stations/)
- Exact resource: `33a48965-adef-4252-a90c-6e3bf9385aad`
- Resource type: `file`; declared format: `RSS`
- Latest bounded attempt: `2026-09-04T03:20:20.416715Z`; HTTP `206`;
  media type `text/xml`
- Evidence sample: `4096` bytes; SHA-256 `ca144dd6616cbf4edc743e702345f0153b3e40c1de6a817852900c730cfb0518`

The check read only a bounded sample. It proves that this exact URL returned a non-empty successful
response at the recorded time; it does not guarantee later availability, completeness, or fitness.

## Before using the data

Review the provider's current dataset and platform terms before commercial use, caching, scraping,
or redistribution. This technical example does not grant rights in provider data.
