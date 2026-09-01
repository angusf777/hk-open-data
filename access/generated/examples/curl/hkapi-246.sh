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
  'https://data.gov.hk/en-data/api/3/action/package_show?id=hk-swd-elderly-list-of-enhanced-home-and-community-care-services-teams'
# Current underlying resource URLs are in .result.resources[].url
