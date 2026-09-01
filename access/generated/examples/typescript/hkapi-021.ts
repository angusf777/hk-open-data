const response = await fetch("https://www.als.gov.hk/lookup?q=10+Queensway&n=10", {
  method: "GET",
  headers: {
    "accept": "application/json",
    "accept-language": "en, zh-Hant",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
