const response = await fetch("https://data.gov.hk/filestore/feeds/data_rss_en.xml", {
  method: "GET",
  headers: {
    "accept": "application/rss+xml",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
