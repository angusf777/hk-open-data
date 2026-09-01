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
  'https://data.gov.hk/en-data/api/3/action/package_show?id=starferry-starferry-ferry-service-timetables-and-fare-tables-of-star-ferry'
# Current underlying resource URLs are in .result.resources[].url
