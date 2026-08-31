import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Clock3, Database, UserRoundCheck } from "lucide-react";
import { useAdminApi } from "../../context.js";
import { CadenceChart } from "./CadenceChart.js";
import { IncidentRail } from "./IncidentRail.js";
import { SourceHealthTable } from "./SourceHealthTable.js";

export function OverviewPage() {
  const api = useAdminApi();
  const sources = useQuery({ queryKey: ["sources"], queryFn: () => api.listSources() });
  const incidents = useQuery({ queryKey: ["incidents"], queryFn: () => api.listIncidents() });
  if (sources.isPending || incidents.isPending) return <p className="page-state" role="status">Loading operations evidence…</p>;
  if (sources.isError || incidents.isError) return <p className="page-state page-state--error" role="alert">Operations evidence is unavailable. Retry after checking the API gateway.</p>;
  const healthy = sources.data.filter((item) => item.freshness === "fresh").length;
  const stale = sources.data.filter((item) => item.freshness === "stale").length;
  const pending = sources.data.filter((item) => item.approval === "pending").length;
  return (
    <div className="overview-layout">
      <div className="overview-primary">
        <header className="page-header"><div><p className="eyebrow">OPERATIONS / LOCAL EVIDENCE</p><h1>Operations overview</h1><p>Local runtime summary of explicitly activated sources and delivery attempts.</p></div><p className="updated"><span>Fixture snapshot</span><time dateTime="2026-08-28T10:24:18+08:00">10:24:18 HKT<br />28 Aug 2026</time></p></header>
        <section className="metric-strip" aria-label="Operational summary">
          <Metric label="Sources" value={sources.data.length} detail="Total" icon={<Database />} tone="neutral" />
          <Metric label="Healthy" value={healthy} detail={`${Math.round((healthy / sources.data.length) * 100)}%`} icon={<CheckCircle2 />} tone="healthy" />
          <Metric label="Stale" value={stale} detail={`${Math.round((stale / sources.data.length) * 100)}%`} icon={<Clock3 />} tone="pending" />
          <Metric label="Pending approval" value={pending} detail={`${Math.round((pending / sources.data.length) * 100)}%`} icon={<UserRoundCheck />} tone="pending" />
          <Metric label="Active incidents" value={incidents.data.length} detail={`${incidents.data.filter((item) => item.severity === "critical").length} Critical`} icon={<AlertTriangle />} tone="incident" />
        </section>
        <section aria-labelledby="source-health-title"><div className="section-heading"><h2 id="source-health-title">Source health</h2><a href="/sources">View all sources</a></div><SourceHealthTable sources={sources.data.slice(0, 5)} /></section>
      </div>
      <aside className="overview-rail"><IncidentRail incidents={incidents.data.filter((item) => item.status !== "resolved")} /><CadenceChart /></aside>
    </div>
  );
}

function Metric({ label, value, detail, icon, tone }: { label: string; value: number; detail: string; icon: React.ReactNode; tone: string }) {
  return <div className="metric" data-tone={tone}><div><strong>{label}</strong><span className="metric__value">{value}</span><small>{detail}</small></div><span className="metric__icon" aria-hidden="true">{icon}</span></div>;
}
