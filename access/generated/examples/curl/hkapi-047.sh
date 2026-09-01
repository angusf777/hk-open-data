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
  'https://api.data.gov.hk/v1/carpark-info-vacancy?data=vacancy&vehicleTypes=privateCar&lang=en_US'
