const response = await fetch("https://rt.data.gov.hk/v1/transport/mtr/lrt/getSchedule?station_id=001", {
  method: "GET",
  headers: {
    "accept": "application/json",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
