import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { DataTable, StatusDot, StatusLabel } from "@hk-open-data/ui";
import { useAdminApi } from "../../context.js";
import { formatHkt, statusTone } from "../../format.js";

export function SourcesPage() {
  const api = useAdminApi();
  const [approval, setApproval] = useState("all");
  const query = useQuery({ queryKey: ["sources"], queryFn: () => api.listSources() });
  const rows = (query.data ?? []).filter((item) => approval === "all" || item.approval === approval);
  return <div className="standard-page"><header className="page-header"><div><p className="eyebrow">GOVERNANCE</p><h1>Sources</h1><p>Rights, connector versions, freshness and review state.</p></div></header><div className="filter-bar"><label>Approval status<select value={approval} onChange={(event) => setApproval(event.target.value)}><option value="all">All</option><option value="approved">Approved</option><option value="pending">Pending</option><option value="restricted">Restricted</option></select></label></div>{query.isPending ? <p role="status">Loading sources…</p> : <DataTable caption="Sources" rows={rows} rowKey={(item) => item.id} columns={[{ key: "id", label: "ID", render: (item) => item.id }, { key: "source", label: "Source", render: (item) => <><a href={`/sources/${item.id}`}>{item.name}</a><small>{item.provider}</small></> }, { key: "approval", label: "Approval", render: (item) => <StatusLabel tone={statusTone(item.approval)}>{item.approval}</StatusLabel> }, { key: "freshness", label: "Freshness", render: (item) => <StatusDot tone={statusTone(item.freshness)}>{item.freshness}</StatusDot> }, { key: "success", label: "Last success", render: (item) => formatHkt(item.lastSuccess) }]} />}</div>;
}
