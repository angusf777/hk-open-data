import httpx

url = 'https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=flw&lang=en'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    print(response.text)
