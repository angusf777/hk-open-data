import httpx

url = 'https://data.gov.hk/en-data/api/3/action/group_show?id=environment'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
