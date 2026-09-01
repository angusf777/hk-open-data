import httpx

url = 'https://resource.data.one.gov.hk/td/carpark/basic_info_all.json'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
