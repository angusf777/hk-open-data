curl \
  --fail-with-body \
  --silent \
  --show-error \
  --max-time \
  15 \
  --request \
  GET \
  --header \
  'accept: application/rss+xml' \
  https://data.gov.hk/filestore/feeds/data_rss_en.xml
