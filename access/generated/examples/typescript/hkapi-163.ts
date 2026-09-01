const response = await fetch("https://app.legco.gov.hk/wcod/odata/VArchiveMeeting?%24top=10&%24skip=0", {
  method: "GET",
  headers: {
    "accept": "application/json",
  },
  signal: AbortSignal.timeout(15000),
  redirect: "manual",
});

if (!response.ok) throw new Error(`Provider request failed (${response.status})`);
console.log(await response.text());
