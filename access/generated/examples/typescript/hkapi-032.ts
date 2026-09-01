const response = await fetch("https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=TKL&sta=TKO&lang=EN", {
  method: "GET",
  headers: {
    "accept": "application/json",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
