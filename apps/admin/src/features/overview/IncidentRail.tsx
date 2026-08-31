import { DataTable, StatusLabel } from "@hk-open-data/ui";
import type { AdminIncident } from "../../api.js";
import { formatHkt, statusTone } from "../../format.js";

export function IncidentRail({ incidents }: { incidents: AdminIncident[] }) {
  return (
    <section className="admin-rail-section" aria-labelledby="active-incidents">
      <div className="section-heading"><h2 id="active-incidents">Active incidents</h2><a href="/incidents">View all</a></div>
      <DataTable
        caption="Active incidents"
        rows={incidents}
        rowKey={(item) => item.id}
        empty="No reviewed active incidents"
        columns={[
          { key: "severity", label: "Severity", render: (item) => <StatusLabel tone={statusTone(item.severity)}>{item.severity}</StatusLabel> },
          { key: "source", label: "Source", render: (item) => item.sourceId },
          { key: "state", label: "State", render: (item) => <><a href="/incidents">{item.status}</a><small>{item.summary}</small></> },
          { key: "opened", label: "Opened", render: (item) => formatHkt(item.openedAt) },
        ]}
      />
    </section>
  );
}
