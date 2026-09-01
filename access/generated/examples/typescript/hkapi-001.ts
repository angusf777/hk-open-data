const response = await fetch("https://data.gov.hk/en-data/api/3/action/package_list?limit=10&offset=0", {
  method: "GET",
  headers: {
    "accept": "application/json",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
