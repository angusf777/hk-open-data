const endpoints = [
  "http://127.0.0.1:3000/health/ready",
  "http://127.0.0.1:3000/v1/status/summary",
  "http://127.0.0.1:3100/healthz",
  "http://127.0.0.1:8080/healthz",
  "http://127.0.0.1:8081/healthz",
];

for (const endpoint of endpoints) {
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
}
console.log(`local smoke passed (${endpoints.length} endpoints)`);
