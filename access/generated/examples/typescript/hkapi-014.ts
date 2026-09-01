const response = await fetch("https://portal.csdi.gov.hk/geoportal/csw?service=CSW&request=GetCapabilities&version=2.0.2", {
  method: "GET",
  headers: {
    "accept": "application/xml",
  },
  signal: AbortSignal.timeout(30000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
