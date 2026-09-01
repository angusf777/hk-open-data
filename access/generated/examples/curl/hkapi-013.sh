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
  'https://portal.csdi.gov.hk/server/services/common/landsd_rcd_1648571595120_89752/MapServer/WFSServer?service=WFS&version=2.0.0&request=GetCapabilities'
