import httpx

url = 'https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule'
headers = {
    'accept': 'application/json',
    'content-type': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('POST', url, headers=headers, json={'language': 'en', 'routeName': 'K12'})
    response.raise_for_status()
    print(response.text)
