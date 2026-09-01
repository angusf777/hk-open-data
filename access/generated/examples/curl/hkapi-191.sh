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
  'https://data.gov.hk/en-data/api/3/action/package_show?id=cfs-foodalert-foodalert'
# Current underlying resource URLs are in .result.resources[].url
