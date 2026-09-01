import httpx

url = 'https://api.data.gov.hk/v1/nearest-schools?lat=22.2812&long=114.1659&max=5'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
