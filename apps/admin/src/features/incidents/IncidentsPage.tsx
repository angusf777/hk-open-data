import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, DataTable, StatusLabel } from "@hk-open-data/ui";
import { useState } from "react";

import { useAdminApi } from "../../context.js";
import { formatHkt, statusTone } from "../../format.js";

export function IncidentsPage() {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const [reason, setReason] = useState("");
  const [publicEn, setPublicEn] = useState("");
  const [publicZh, setPublicZh] = useState("");
  const [correctionReference, setCorrectionReference] = useState("");
  const query = useQuery({ queryKey: ["incidents"], queryFn: () => api.listIncidents() });
  const first = query.data?.[0];
  const acknowledge = useMutation({
    mutationFn: async () => {
      if (first !== undefined) {
        await api.actOnIncident(first.id, "acknowledge", first.version, { reason });
      }
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["incidents"] }),
  });
  const publication = useMutation({
    mutationFn: async () => {
      if (first === undefined) return;
      const correcting = first.publicState === "published" || first.publicState === "corrected";
      await api.actOnIncident(first.id, correcting ? "correct" : "publish", first.version, {
        reason,
        public_summary: { en: publicEn, zh_Hant: publicZh },
        ...(correcting ? { correction_reference: correctionReference } : {}),
      });
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["incidents"] }),
  });
  const correcting = first?.publicState === "published" || first?.publicState === "corrected";
  const wordingComplete =
    reason.trim() !== "" &&
    publicEn.trim() !== "" &&
    publicZh.trim() !== "" &&
    (!correcting || correctionReference.trim() !== "");

  return (
    <div className="standard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">QUALITY OPERATIONS</p>
          <h1>Incidents</h1>
          <p>Reviewed observations, state transitions and public wording.</p>
        </div>
      </header>
      {query.isPending ? (
        <p role="status">Loading incidents…</p>
      ) : (
        <DataTable
          caption="Incidents"
          rows={query.data ?? []}
          rowKey={(item) => item.id}
          columns={[
            {
              key: "severity",
              label: "Severity",
              render: (item) => (
                <StatusLabel tone={statusTone(item.severity)}>{item.severity}</StatusLabel>
              ),
            },
            {
              key: "incident",
              label: "Incident",
              render: (item) => (
                <>
                  <strong>{item.id}</strong>
                  <small>{item.summary}</small>
                </>
              ),
            },
            { key: "source", label: "Source", render: (item) => item.sourceId },
            { key: "state", label: "State", render: (item) => item.status },
            { key: "public", label: "Public", render: (item) => item.publicState },
            { key: "opened", label: "Opened", render: (item) => formatHkt(item.openedAt) },
          ]}
        />
      )}
      <form
        className="inline-action"
        onSubmit={(event) => {
          event.preventDefault();
          acknowledge.mutate();
        }}
      >
        <label>
          Incident action reason
          <input value={reason} onChange={(event) => setReason(event.target.value)} />
        </label>
        <Button
          type="submit"
          disabled={reason.trim() === "" || first === undefined || acknowledge.isPending}
        >
          Acknowledge incident
        </Button>
        {acknowledge.isSuccess ? <span role="status">Acknowledgement audited.</span> : null}
      </form>
      <section className="activation-panel" aria-labelledby="public-wording-heading">
        <div>
          <p className="eyebrow">REVIEWED PUBLIC CLAIM</p>
          <h2 id="public-wording-heading">{correcting ? "Correct public wording" : "Publish incident"}</h2>
          <p>
            English and Traditional Chinese are both required. A correction retains the prior
            wording in append-only audit evidence and requires a correction reference.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            publication.mutate();
          }}
        >
          <label>
            Public summary (English)
            <textarea value={publicEn} onChange={(event) => setPublicEn(event.target.value)} />
          </label>
          <label>
            Public summary (Traditional Chinese)
            <textarea value={publicZh} onChange={(event) => setPublicZh(event.target.value)} />
          </label>
          {correcting ? (
            <label>
              Correction reference
              <input
                value={correctionReference}
                onChange={(event) => setCorrectionReference(event.target.value)}
              />
            </label>
          ) : null}
          <Button type="submit" variant="primary" disabled={!wordingComplete || publication.isPending}>
            {correcting ? "Record correction" : "Publish reviewed wording"}
          </Button>
          {publication.isSuccess ? <p role="status">Public wording transition audited.</p> : null}
          {publication.isError ? <p role="alert">Publication failed. Recheck state, wording and version.</p> : null}
        </form>
      </section>
    </div>
  );
}
