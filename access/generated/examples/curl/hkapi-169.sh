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
  'https://app.legco.gov.hk/OpenData/HansardDB/Hansard?%24top=10&%24skip=0'
