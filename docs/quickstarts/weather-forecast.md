# Weather forecast: Hong Kong Observatory

Request the current Hong Kong local weather forecast as JSON.

## Run it

```bash
curl \
  --fail-with-body \
  --silent \
  --show-error \
  --max-time \
  15 \
  --request \
  GET \
  --header \
  'accept: application/json' \
  'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en'
```

To save the response, add `--output weather-forecast.json` to the cURL command.

## What was verified

- Catalogue source: [`HKAPI-087`](https://angusf777.github.io/hk-open-data/resources/official%3Ahkapi-087/)
- Recipe version: `1.0.0`
- Latest bounded verification: `2026-09-03T04:12:00.644182Z`;
  valid until `2026-09-10T04:12:00.644182Z`
- Observed response: HTTP `200`;
  media type `application/json`; `490` bytes
- Response SHA-256: `50f01f14c5da54783b78451781dbc68a1eef87c3d643e8e09be037c6e780fa42`

The verification is dated evidence, not an uptime promise. Re-run
`hkdata verify HKAPI-087` if the validity date has passed.

## Before using the data

Review the provider's current terms before commercial use, caching, scraping, or redistribution.
This technical example does not grant rights in provider data.
