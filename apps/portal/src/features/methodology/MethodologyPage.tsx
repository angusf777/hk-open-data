export function MethodologyPage() {
  return (
    <main className="public-main public-subpage prose">
      <p className="public-eyebrow">HOW STATUS IS PRODUCED</p>
      <h1>Methodology</h1>
      <p>
        When you enable a source, the self-hosted toolkit can check its public endpoint or
        publication path. API health check mode stores a SHA-256 fingerprint and summary
        measurements, not the response content. Data access mode can store complete responses only
        when you enable storage for that source after reviewing its terms.
      </p>
      <h2>What status means</h2>
      <dl>
        <div><dt>Operational</dt><dd>A qualifying local check passed within its configured cadence.</dd></div>
        <div><dt>Degraded</dt><dd>Observed evidence indicates stale, partial, or semantically changed data.</dd></div>
        <div><dt>Outage</dt><dd>Observed evidence indicates a material failure for the monitored path.</dd></div>
        <div><dt>Not yet observed</dt><dd>No qualifying evidence exists. This never means operational.</dd></div>
      </dl>
      <h2>Limits</h2>
      <p>
        These are independent checks, not a provider service, endorsement, or guarantee. Results
        depend on the checks configured by the person running the toolkit and do not grant permission
        to use a source.
      </p>
    </main>
  );
}
