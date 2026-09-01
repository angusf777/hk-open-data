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
  'https://api.data.gov.hk/v1/nearest-schools?lat=22.2812&long=114.1659&max=5'
