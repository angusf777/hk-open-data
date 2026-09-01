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
  'https://data.gov.hk/en-data/api/3/action/package_show?id=hk-epd-aqmnteam-air-quality-monitoring-network-of-hong-kong'
# Current underlying resource URLs are in .result.resources[].url
