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
  --header \
  'accept-language: en, zh-Hant' \
  'https://www.als.gov.hk/lookup?q=10+Queensway&n=10'
