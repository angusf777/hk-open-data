import httpx

url = 'https://www.als.gov.hk/lookup?q=10+Queensway&n=10'
headers = {
    'accept': 'application/json',
    'accept-language': 'en, zh-Hant',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
