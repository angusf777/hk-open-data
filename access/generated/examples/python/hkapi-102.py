import httpx

url = 'https://data.gov.hk/en-data/api/3/action/package_show?id=hk-epd-airteam-current-air-quality-health-index-range-and-forecast'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    dataset = response.json()["result"]
    for resource in dataset.get("resources", []):
        print(resource.get("url", ""))
