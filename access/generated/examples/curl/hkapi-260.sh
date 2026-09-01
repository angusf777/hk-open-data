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
  'https://data.gov.hk/en-data/api/3/action/package_show?id=hk-ofca-ofca-ofca-dataset-26'
# Current underlying resource URLs are in .result.resources[].url
