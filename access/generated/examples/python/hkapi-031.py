import httpx

url = 'https://data.gov.hk/en-data/api/3/action/package_show?id=hk-dpo-datagovhk1-transport-bus-route-list-and-eta-spcific-bus-stop'
headers = {
    'accept': 'application/json',
}

with httpx.Client(timeout=15.0, follow_redirects=False) as client:
    response = client.request('GET', url, headers=headers)
    response.raise_for_status()
    dataset = response.json()["result"]
    for resource in dataset.get("resources", []):
        print(resource.get("url", ""))
