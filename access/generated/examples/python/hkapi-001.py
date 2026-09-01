import httpx

url = 'https://data.gov.hk/en-data/api/3/action/package_list?limit=10&offset=0'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
