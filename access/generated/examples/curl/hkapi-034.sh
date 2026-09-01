curl \
  --fail-with-body \
  --silent \
  --show-error \
  --max-time \
  15 \
  --request \
  POST \
  --header \
  'accept: application/json' \
  --header \
  'content-type: application/json' \
  --data \
  '{"language": "en", "routeName": "K12"}' \
  https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule
