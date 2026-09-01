const response = await fetch("https://data.gov.hk/en-data/api/3/action/package_show?id=hk-td-tis_2-traffic-snapshot-images", {
  method: "GET",
  headers: {
    "accept": "application/json",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
