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
  'https://data.gov.hk/en-data/api/3/action/package_show?id=hk-rvd-tsinfo_rvd-statistical-tables-on-valuation-list-and-government-rent-roll'
# Current underlying resource URLs are in .result.resources[].url
