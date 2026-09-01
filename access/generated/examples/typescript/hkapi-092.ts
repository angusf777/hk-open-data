const response = await fetch("https://data.weather.gov.hk/weatherAPI/opendata/earthquake.php?dataType=qem&lang=en", {
  method: "GET",
  headers: {
    "accept": "application/json",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
