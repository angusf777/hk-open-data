import httpx

url = 'https://portal.csdi.gov.hk/geoportal/csw?service=CSW&request=GetCapabilities&version=2.0.2'
headers = {
    'accept': 'application/xml',
}

with httpx.Client(timeout=30.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
