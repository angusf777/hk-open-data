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
  'https://data.gov.hk/en-data/api/3/action/package_show?id=hk-dh-chpsebcdd-number-of-notifications-for-notifiable-infectious-diseases'
# Current underlying resource URLs are in .result.resources[].url
