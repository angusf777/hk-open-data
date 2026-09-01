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
  'https://app.legco.gov.hk/vrdb/odata/vVotingResult?%24top=10&%24skip=0'
