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
  'https://app.data.gov.hk/v1/historical-archive/list-files?start=20260829&end=20260830&max=10&skip=0'
