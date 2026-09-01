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
  'https://data.gov.hk/en-data/api/3/action/package_show?id=hk-td-tis_3-routes-and-fares-of-public-transport'
# Current underlying resource URLs are in .result.resources[].url
