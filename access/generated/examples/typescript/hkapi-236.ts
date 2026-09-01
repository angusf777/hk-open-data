const response = await fetch("https://api.data.gov.hk/v1/nearest-schools?lat=22.2812&long=114.1659&max=5", {
  method: "GET",
  headers: {
    "accept": "application/json",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
