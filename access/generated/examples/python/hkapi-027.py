import httpx

url = 'https://rt.data.gov.hk/v1/transport/citybus-nwfb/route/ctb'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
