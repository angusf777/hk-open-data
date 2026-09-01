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
  'https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TKL&sta=TKO&lang=EN'
