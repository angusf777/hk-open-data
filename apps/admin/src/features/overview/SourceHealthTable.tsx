import { Button, DataTable, StatusDot, StatusLabel } from "@hk-open-data/ui";
import type { AdminSource } from "../../api.js";
import { formatHkt, statusTone } from "../../format.js";

export function SourceHealthTable({ sources }: { sources: AdminSource[] }) {
  return (
    <DataTable
      caption="Source health"
      rowKey={(item) => item.id}
      rows={sources}
      columns={[
        { key: "source", label: "Source", render: (item) => <a href={`/sources/${item.id}`}>{item.name}</a> },
        { key: "provider", label: "Provider", render: (item) => item.provider },
        { key: "approval", label: "Approval", render: (item) => <StatusLabel tone={statusTone(item.approval)}>{item.approval === "pending" ? "Pending approval" : "Approved"}</StatusLabel> },
        { key: "freshness", label: "Freshness", render: (item) => <StatusDot tone={statusTone(item.freshness)}>{item.freshness === "fresh" ? "Healthy" : item.freshness === "stale" ? "Stale" : "Unknown"}</StatusDot> },
        { key: "success", label: "Last success", render: (item) => <time dateTime={item.lastSuccess ?? undefined}>{formatHkt(item.lastSuccess)}</time> },
        { key: "action", label: "Action", render: (item) => <Button onClick={() => { window.location.href = `/sources/${item.id}`; }}>Review source</Button> },
      ]}
    />
  );
}
