const response = await fetch("https://app.data.gov.hk/v1/historical-archive/list-files?start=20260829&end=20260830&max=10&skip=0", {
  method: "GET",
  headers: {
    "accept": "application/json",
  },
  signal: AbortSignal.timeout(30000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
