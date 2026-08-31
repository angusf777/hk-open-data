const intervals = Array.from({ length: 15 }, (_, index) => index);

export function CadenceChart() {
  return (
    <section className="admin-rail-section" aria-labelledby="cadence-title">
      <h2 id="cadence-title">Cadence execution (last 24h)</h2>
      <p className="chart-legend"><span data-tone="pass">Success</span><span data-tone="partial">Partial</span><span data-tone="fail">Failed</span></p>
      <div className="cadence-chart" role="img" aria-label="Cadence checks: mostly successful; one partial and one failed interval in the last 24 hours">
        {intervals.map((index) => <span key={index} data-anomaly={index === 12 ? "partial" : index === 13 ? "fail" : "pass"} />)}
      </div>
      <a className="rail-link" href="/targets">View cadence monitor</a>
    </section>
  );
}
