curl \
  --fail-with-body \
  --silent \
  --show-error \
  --max-time \
  30 \
  --request \
  GET \
  --header \
  'accept: application/xml' \
  'https://portal.csdi.gov.hk/geoportal/csw?service=CSW&request=GetCapabilities&version=2.0.2'
