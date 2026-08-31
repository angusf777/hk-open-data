const baseUrl = process.env.API_SMOKE_URL ?? "http://127.0.0.1:3000";
const requestCount = Number(process.env.API_SMOKE_REQUESTS ?? "100");
const maximumP95 = Number(process.env.API_SMOKE_P95_MS ?? "500");
const latencies = [];
for (let index = 0; index < requestCount; index += 1) {
  const started = performance.now();
  const response = await fetch(`${baseUrl}/v1/status/summary`, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`status request failed with ${response.status}`);
  latencies.push(performance.now() - started);
}
latencies.sort((left, right) => left - right);
const p95 = latencies[Math.ceil(latencies.length * 0.95) - 1] ?? Infinity;
if (p95 > maximumP95) throw new Error(`p95 ${p95.toFixed(1)}ms exceeds ${maximumP95}ms`);
console.log(JSON.stringify({ requests: requestCount, p95_ms: Number(p95.toFixed(1)), threshold_ms: maximumP95 }));
