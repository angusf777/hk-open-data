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
  'https://data.gov.hk/en-data/api/3/action/package_show?id=hk-rvd-tsinfo_rvd-summary-of-newly-built-properties-assessed-to-rates-and-or-gov-rent'
# Current underlying resource URLs are in .result.resources[].url
