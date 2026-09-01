import httpx

url = 'https://app.legco.gov.hk/ScheduleDB/odata/Tmeeting?%24top=10&%24skip=0'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
