const response = await fetch("https://mapapi.geodata.gov.hk/gs/api/v1.0.0/xyz/basemap/HK80/11/287/385.png", {
  method: "GET",
  headers: {
    "accept": "image/png",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
