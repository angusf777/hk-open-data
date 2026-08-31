import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button, StatusLabel } from "@hk-open-data/ui";
import { useState } from "react";
import { useParams } from "react-router-dom";

import { useAdminApi } from "../../context.js";
import { statusTone } from "../../format.js";

function defaultExpiry(): string {
  const expiry = new Date();
  expiry.setUTCFullYear(expiry.getUTCFullYear() + 1);
  return expiry.toISOString().slice(0, 10);
}

export function SourceReviewPage() {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const { sourceId = "" } = useParams();
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const [expiresOn, setExpiresOn] = useState(defaultExpiry);
  const [connectorId, setConnectorId] = useState("");
  const [codeVersion, setCodeVersion] = useState("");
  const [endpoint, setEndpoint] = useState("");
  const [cadenceSeconds, setCadenceSeconds] = useState("86400");
  const [fixtureEvidence, setFixtureEvidence] = useState("");
  const [probeEvidence, setProbeEvidence] = useState("");
  const [activationReason, setActivationReason] = useState("");
  const query = useQuery({ queryKey: ["sources"], queryFn: () => api.listSources() });
  const item = query.data?.find((source) => source.id === sourceId);
  const approval = useMutation({
    mutationFn: async () => {
      if (item === undefined) return;
      await api.decideSource(item.id, item.version, {
        decision: "approved",
        projects: ["P01", "P14"],
        purposes: ["connector-observation", "quality-monitoring"],
        storage: "content-addressed private evidence",
        retention: "source-specific policy",
        redistribution: "operator-defined; verify source-specific evidence",
        attribution: "provider attribution required",
        evidence: [evidence],
        expires_at: `${expiresOn}T23:59:59Z`,
        reason,
      });
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });
  const connector = useMutation({
    mutationFn: async () => {
      if (item === undefined || item.sourceGroupId === null) return;
      await api.activateConnector(item.id, item.version, {
        connector_id: connectorId,
        source_group_id: item.sourceGroupId,
        code_version: codeVersion,
        endpoint,
        method: "GET",
        request_body: null,
        project: "P01",
        purpose: "connector-observation",
        timeout_ms: 30000,
        max_response_bytes: 10485760,
        max_compressed_response_bytes: 10485760,
        max_attempts: 3,
        pagination: null,
        cadence_seconds: Number(cadenceSeconds),
        fixture_evidence_url: fixtureEvidence,
        live_probe_evidence_url: probeEvidence,
        reason: activationReason,
      });
    },
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["sources"] }),
  });

  if (query.isPending) return <p role="status">Loading source review…</p>;
  if (item === undefined) {
    return (
      <div className="standard-page">
        <h1>Review source</h1>
        <p>Source not found or access denied.</p>
      </div>
    );
  }
  const sourceApproved = item.approval === "approved" || item.approval === "restricted";
  const connectorComplete =
    connectorId !== "" &&
    codeVersion !== "" &&
    endpoint.startsWith("https://") &&
    Number(cadenceSeconds) > 0 &&
    fixtureEvidence !== "" &&
    probeEvidence !== "" &&
    activationReason !== "";

  return (
    <div className="standard-page review-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">SOURCE {item.id}</p>
          <h1>Review source — {item.name}</h1>
          <p>{item.provider}</p>
        </div>
        <StatusLabel tone={statusTone(item.approval)}>{item.approval}</StatusLabel>
      </header>
      <section className="review-grid">
        <div>
          <h2>Activation evidence</h2>
          <dl className="definition-list">
            <div>
              <dt>Source group</dt>
              <dd>{item.sourceGroupId ?? "P14-only; no P01 connector"}</dd>
            </div>
            <div>
              <dt>Connector state</dt>
              <dd>{sourceApproved ? "Approval recorded; version activation required" : "Quarantined until approval"}</dd>
            </div>
            <div>
              <dt>Terms evidence</dt>
              <dd>{item.termsEvidenceState ?? "not-reviewed"}</dd>
            </div>
            <div>
              <dt>Runtime activation</dt>
              <dd>{sourceApproved ? "eligible; exact connector activation still required" : "not activated"}</dd>
            </div>
            <div>
              <dt>Freshness</dt>
              <dd>{item.freshness}</dd>
            </div>
            <div>
              <dt>Optimistic version</dt>
              <dd>{item.version}</dd>
            </div>
          </dl>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            approval.mutate();
          }}
        >
          <h2>Source activation decision</h2>
          <p className="evidence-disclaimer">This record describes research only. It does not authorize commercial use, caching, redistribution, or provider access.</p>
          <label>
            Decision reason
            <textarea required value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          <label>
            Evidence URL
            <input required type="url" value={evidence} onChange={(event) => setEvidence(event.target.value)} />
          </label>
          <label>
            Approval expiry
            <input required type="date" value={expiresOn} onChange={(event) => setExpiresOn(event.target.value)} />
          </label>
          <Button variant="primary" type="submit" disabled={reason === "" || evidence === "" || approval.isPending}>
            Approve source
          </Button>
          {approval.isSuccess ? <p role="status">Approval decision recorded in the audit trail.</p> : null}
          {approval.isError ? <p role="alert">Decision failed. Verify scope, evidence and version, then retry.</p> : null}
        </form>
      </section>

      {sourceApproved && item.sourceGroupId !== null ? (
        <section className="activation-panel" aria-labelledby="connector-heading">
          <div>
            <p className="eyebrow">CONNECTOR OPERATOR</p>
            <h2 id="connector-heading">Activate an exact connector version</h2>
            <p>
              This step creates the scheduler job only after the fixture suite and operator-reviewed
              live sandbox probe have evidence URLs. The worker rechecks activation before every run.
            </p>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              connector.mutate();
            }}
          >
            <label>
              Connector ID
              <input value={connectorId} onChange={(event) => setConnectorId(event.target.value)} />
            </label>
            <label>
              Code version
              <input value={codeVersion} onChange={(event) => setCodeVersion(event.target.value)} />
            </label>
            <label>
              Reviewed HTTPS endpoint
              <input type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)} />
            </label>
            <label>
              Cadence seconds
              <input type="number" min="1" value={cadenceSeconds} onChange={(event) => setCadenceSeconds(event.target.value)} />
            </label>
            <label>
              Passing fixture evidence URL
              <input type="url" value={fixtureEvidence} onChange={(event) => setFixtureEvidence(event.target.value)} />
            </label>
            <label>
              Reviewed live-probe evidence URL
              <input type="url" value={probeEvidence} onChange={(event) => setProbeEvidence(event.target.value)} />
            </label>
            <label>
              Activation reason
              <textarea value={activationReason} onChange={(event) => setActivationReason(event.target.value)} />
            </label>
            <Button variant="primary" type="submit" disabled={!connectorComplete || connector.isPending}>
              Activate connector
            </Button>
            {connector.isSuccess ? <p role="status">Connector and scheduler job activated.</p> : null}
            {connector.isError ? <p role="alert">Activation failed. Recheck approval, group, evidence and version.</p> : null}
          </form>
        </section>
      ) : null}
    </div>
  );
}
