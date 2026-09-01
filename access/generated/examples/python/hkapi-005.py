import httpx

url = 'https://app.data.gov.hk/v1/historical-archive/list-files?start=20260829&end=20260830&max=10&skip=0'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=30.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
