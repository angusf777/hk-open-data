import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, ShieldCheck } from "lucide-react";
import { DataTable, StatusDot, StatusLabel } from "@hk-open-data/ui";
import { usePortal } from "../../context.js";
import { publicTone, SourceStatusRow } from "./SourceStatusRow.js";

function hkt(value: string): string { return new Intl.DateTimeFormat("en-HK", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Hong_Kong" }).format(new Date(value)); }

export function StatusPage() {
  const { api, copy, now } = usePortal();
  const dashboard = useQuery({ queryKey: ["public-dashboard"], queryFn: () => api.getDashboard() });
  if (dashboard.isPending) return <main className="public-main"><p role="status">Loading reviewed evidence…</p></main>;
  if (dashboard.isError) return <main className="public-main"><h1>{copy.title}</h1><p role="alert">Public status is unavailable and no valid snapshot could be loaded.</p></main>;
  const { status, incidents, sources } = dashboard.data;
  const reviewed = incidents.filter((item) => item.reviewed);
  const stale = status.snapshot || now().getTime() - new Date(status.generatedAt).getTime() > 2 * 60 * 60 * 1000;
  return <main className="public-main">
    <section className="public-summary" data-testid="public-section-summary" data-section="summary"><div><h1>{copy.title}</h1><p className="overall"><AlertTriangle aria-hidden="true" />{copy.affected}</p><p className="reviewed"><ShieldCheck aria-hidden="true" />{copy.reviewed}</p><p className="last-updated"><strong>{stale ? copy.snapshot : copy.updated}</strong> <time dateTime={status.generatedAt}>{hkt(status.generatedAt)} HKT</time></p>{stale ? <p className="snapshot-warning" role="status">{copy.stale}</p> : null}</div><div className="public-counts" aria-label="Status counts"><Count label={copy.operational} value={status.counts.operational} tone="healthy" /><Count label={copy.degraded} value={status.counts.degraded} tone="pending" /><Count label={copy.outage} value={status.counts.outage} tone="incident" /><Count label={copy.unknown} value={status.counts.unknown} tone="neutral" /></div></section>
    <aside className="public-notice" data-testid="public-section-notice" data-section="notice"><Info aria-hidden="true" /><p>{copy.notice}</p></aside>
    <section className="public-section" data-testid="public-section-incidents" data-section="incidents"><div className="public-section__heading"><h2>{copy.incidents}</h2><a href="/status/history">{copy.viewAll}</a></div><DataTable caption={copy.incidents} rows={reviewed} rowKey={(item) => item.id} empty={copy.noIncidents} columns={[{ key: "service", label: "Service", render: (item) => <><a href={`/status/incidents/${item.id}`}>{item.sourceName}</a><small>{item.summary}</small></> }, { key: "provider", label: "Provider", render: (item) => item.provider }, { key: "severity", label: "Severity", render: (item) => <StatusLabel tone={publicTone(item.severity === "major" ? "outage" : "stale")}>{item.severity}</StatusLabel> }, { key: "state", label: "State", render: (item) => <StatusDot tone={publicTone(item.severity === "major" ? "outage" : "stale")}>{item.state}</StatusDot> }, { key: "opened", label: "Opened (HKT)", render: (item) => hkt(item.openedAt) }]} /></section>
    <section className="public-section" data-testid="public-section-sources" data-section="sources"><div className="public-section__heading"><h2>{copy.sourceStatus}</h2><a href="/sources">{copy.viewAll}</a></div><DataTable caption={copy.sourceStatus} rows={sources} rowKey={(item) => item.id} columns={[{ key: "provider", label: "Provider / source", render: (item) => <SourceStatusRow source={item} /> }, { key: "authority", label: "Authority", render: (item) => item.authority }, { key: "status", label: "Status", render: (item) => <StatusDot tone={publicTone(item.freshness)}>{item.freshness}</StatusDot> }, { key: "observed", label: "Last observed", render: (item) => item.lastObserved === null ? "Not yet observed" : hkt(item.lastObserved) }]} /></section>
  </main>;
}
function Count({ label, value, tone }: { label: string; value: number; tone: "healthy" | "pending" | "incident" | "neutral" }) { return <div><StatusDot tone={tone}>{label}</StatusDot><strong>{value}</strong></div>; }
