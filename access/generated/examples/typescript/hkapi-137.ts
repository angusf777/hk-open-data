const response = await fetch("https://data.gov.hk/en-data/api/3/action/package_show?id=hk-fsd-fsd1-fsdaedapi", {
  method: "GET",
  headers: {
    "accept": "application/json",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
const document = await response.json();
const dataset = document.result;
for (const resource of dataset.resources ?? []) console.log(resource.url);
