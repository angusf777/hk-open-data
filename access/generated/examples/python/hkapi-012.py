import httpx

url = 'https://data.gov.hk/filestore/feeds/data_rss_en.xml'
headers = {
    'accept': 'application/rss+xml',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
