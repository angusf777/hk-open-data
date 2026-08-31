import { useQuery } from "@tanstack/react-query";
import { DataTable, StatusDot } from "@hk-open-data/ui";
import { usePortal } from "../../context.js";
import { publicTone } from "../status/SourceStatusRow.js";
function evidenceLabel(value: string | undefined): string {
  return (value ?? "not-reviewed").replaceAll("-", " ");
}

function isActivated(value: string | undefined): boolean {
  return value === "approved" || value === "restricted" || value === "active";
}

export function PublicSourcesPage() { const { api, copy } = usePortal(); const query = useQuery({ queryKey: ["public-sources"], queryFn: () => api.listSources() }); return <main className="public-main public-subpage"><p className="public-eyebrow">EVIDENCE-LABELLED PUBLIC REGISTER</p><h1>{copy.sources}</h1><p>Coverage, authority, freshness, evidence state and known limitations. Evidence labels do not grant permission to access or reuse a source.</p>{query.isPending ? <p role="status">Loading sources…</p> : <DataTable caption="Evidence-labelled public sources" rows={query.data ?? []} rowKey={(item) => item.id} columns={[{ key: "source", label: "Source", render: (item) => <><strong>{item.name}</strong><small>{item.id}</small><small>{copy.termsEvidence}: {evidenceLabel(item.termsEvidenceState)}</small><small>{copy.sourceAccess}: {isActivated(item.activationStatus) ? copy.activated : copy.notActivated}</small></> }, { key: "provider", label: "Provider", render: (item) => item.provider }, { key: "authority", label: "Authority", render: (item) => item.authority }, { key: "freshness", label: "Freshness", render: (item) => <StatusDot tone={publicTone(item.freshness)}>{item.freshness}</StatusDot> }, { key: "limitations", label: "Known limitations", render: (item) => item.limitations.length === 0 ? "None currently reviewed" : item.limitations.join("; ") }]} />}</main>; }
