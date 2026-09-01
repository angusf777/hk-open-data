curl \
  --fail-with-body \
  --silent \
  --show-error \
  --max-time \
  30 \
  --request \
  GET \
  --header \
  'accept: application/json' \
  'https://api.hkma.gov.hk/public/market-data-and-statistics/monthly-statistical-bulletin/er-ir/er-eeri-daily?pagesize=10&offset=0'
