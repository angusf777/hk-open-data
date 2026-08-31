export function MethodologyPage() {
  return (
    <main className="public-main public-subpage prose">
      <p className="public-eyebrow">HOW STATUS IS PRODUCED</p>
      <h1>Methodology</h1>
      <p>
        When a local operator explicitly activates a source, HK Open Data Runtime can observe its
        public endpoint or publication path. The observe profile stores response digests and
        metadata; the fabric profile can preserve raw evidence only after separate source-specific
        approval.
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
        This is independent monitoring, not a provider service, endorsement, or guarantee. Runtime
        status reflects one operator&apos;s configured checks and does not determine legal permission.
      </p>
    </main>
  );
}
