const response = await fetch("https://portal.csdi.gov.hk/server/services/common/landsd_rcd_1648571595120_89752/MapServer/WFSServer?service=WFS&version=2.0.0&request=GetCapabilities", {
  method: "GET",
  headers: {
    "accept": "application/xml",
  },
  signal: AbortSignal.timeout(30000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
