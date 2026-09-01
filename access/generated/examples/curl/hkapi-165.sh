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
  'https://app.legco.gov.hk/ScheduleDB/odata/Tmeeting?%24top=10&%24skip=0'
