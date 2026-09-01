const response = await fetch("https://rt.data.gov.hk/v1/transport/mtr/bus/getSchedule", {
  method: "POST",
  headers: {
    "accept": "application/json",
    "content-type": "application/json",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
  body: "{\"language\": \"en\", \"routeName\": \"K12\"}",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
