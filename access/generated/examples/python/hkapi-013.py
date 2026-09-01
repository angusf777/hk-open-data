import httpx

url = 'https://portal.csdi.gov.hk/server/services/common/landsd_rcd_1648571595120_89752/MapServer/WFSServer?service=WFS&version=2.0.0&request=GetCapabilities'
headers = {
    'accept': 'application/xml',
}

with httpx.Client(timeout=30.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
