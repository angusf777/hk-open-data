import httpx

url = 'https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/HK80/11/287/385.png'
headers = {
    'accept': 'image/png',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
