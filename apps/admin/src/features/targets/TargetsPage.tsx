import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DataTable, StatusDot } from "@hk-open-data/ui";
import { useMemo, useState, type FormEvent } from "react";

import { useAdminApi } from "../../context.js";
import { formatHkt, statusTone } from "../../format.js";

export function TargetsPage() {
  const api = useAdminApi();
  const queryClient = useQueryClient();
  const targets = useQuery({ queryKey: ["targets"], queryFn: () => api.listTargets() });
  const sources = useQuery({ queryKey: ["sources"], queryFn: () => api.listSources() });
  const [selectedId, setSelectedId] = useState("");
  const [operatorIdentity, setOperatorIdentity] = useState("");
  const [ruleVersion, setRuleVersion] = useState("");
  const [evidenceId, setEvidenceId] = useState("");
  const [reason, setReason] = useState("");
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [schemaShape, setSchemaShape] = useState('{"/":"object"}');
  const [formError, setFormError] = useState<string | null>(null);
  const selected = useMemo(
    () => targets.data?.find((target) => target.id === selectedId) ?? null,
    [selectedId, targets.data],
  );
  const source = sources.data?.find((item) => item.id === selected?.sourceId);
  const sourceApproved = source?.approval === "approved" || source?.approval === "restricted";
  const complete =
    selected !== null &&
    selected.activation !== "approved" &&
    sourceApproved &&
    operatorIdentity.trim() !== "" &&
    ruleVersion.trim() !== "" &&
    evidenceId.trim() !== "" &&
    reason.trim() !== "";
  const activation = useMutation({
    mutationFn: async () => {
      if (selected === null) throw new Error("Select a monitor target");
      let shape: unknown;
      try {
        shape = JSON.parse(schemaShape);
      } catch {
        throw new Error("Baseline schema shape must be valid JSON");
      }
      if (typeof shape !== "object" || shape === null || Array.isArray(shape)) {
        throw new Error("Baseline schema shape must be a JSON object");
      }
      await api.activateTarget(selected.id, selected.version, {
        reason: reason.trim(),
        operator_identity: operatorIdentity.trim(),
        rule_version: ruleVersion.trim(),
        public_visibility: visibility,
        baseline: {
          evidence_observation_ids: [evidenceId.trim()],
          freshness_rule: "retrieval_only",
          schema_shape: shape,
          required_pointers: [],
        },
      });
    },
    onSuccess: async () => {
      setFormError(null);
      await queryClient.invalidateQueries({ queryKey: ["targets"] });
    },
    onError: (error) => setFormError(error instanceof Error ? error.message : "Activation failed"),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    activation.mutate();
  }

  return (
    <div className="standard-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">P14 OBSERVATORY</p>
          <h1>Monitor targets</h1>
          <p>Cadence, activation evidence, current outcome and the latest accepted observation.</p>
        </div>
      </header>
      {targets.isPending ? (
        <p role="status">Loading monitor targets…</p>
      ) : (
        <DataTable
          caption="Monitor targets"
          rows={targets.data ?? []}
          rowKey={(item) => item.id}
          columns={[
            { key: "id", label: "Monitor", render: (item) => item.id },
            { key: "source", label: "Source", render: (item) => item.sourceId },
            { key: "provider", label: "Provider", render: (item) => item.provider },
            {
              key: "activation",
              label: "Activation",
              render: (item) => (
                <StatusDot tone={statusTone(item.activation)}>{item.activation}</StatusDot>
              ),
            },
            {
              key: "outcome",
              label: "Outcome",
              render: (item) => (
                <StatusDot tone={statusTone(item.outcome)}>{item.outcome}</StatusDot>
              ),
            },
            {
              key: "checked",
              label: "Last checked",
              render: (item) => formatHkt(item.lastChecked),
            },
          ]}
        />
      )}

      <section className="activation-panel" aria-labelledby="activation-heading">
        <div>
          <p className="eyebrow">CONTROLLED WRITE</p>
          <h2 id="activation-heading">Activate a reviewed monitor</h2>
          <p>
            Activation creates a versioned baseline and scheduler job. The API and database both
            reject incomplete or unapproved targets.
          </p>
          <ul>
            <li>Effective P14 quality-monitoring source approval</li>
            <li>One accountable local operator and immutable rule version</li>
            <li>Evidence observation and final visibility decision</li>
          </ul>
        </div>
        <form onSubmit={submit}>
          <label>
            Monitor target
            <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
              <option value="">Select target</option>
              {(targets.data ?? [])
                .filter((target) => target.activation !== "approved")
                .map((target) => (
                  <option key={target.id} value={target.id}>
                    {target.id} · {target.sourceId}
                  </option>
                ))}
            </select>
          </label>
          {selected !== null && !sourceApproved ? (
            <p className="page-state--error" role="alert">
              Source {selected.sourceId} does not have an effective approval in this view.
            </p>
          ) : null}
          <label>
            Operator identity
            <input
              value={operatorIdentity}
              onChange={(event) => setOperatorIdentity(event.target.value)}
            />
          </label>
          <label>
            Rule version
            <input value={ruleVersion} onChange={(event) => setRuleVersion(event.target.value)} />
          </label>
          <label>
            Evidence observation ID
            <input value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} />
          </label>
          <label>
            Baseline schema shape (JSON)
            <textarea value={schemaShape} onChange={(event) => setSchemaShape(event.target.value)} />
          </label>
          <label>
            Public visibility
            <select
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as "private" | "public")}
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </label>
          <label>
            Activation reason
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} />
          </label>
          {formError !== null ? (
            <p className="page-state--error" role="alert">
              {formError}
            </p>
          ) : null}
          <button className="ui-button" type="submit" disabled={!complete || activation.isPending}>
            {activation.isPending ? "Activating…" : "Activate monitor"}
          </button>
        </form>
      </section>
    </div>
  );
}
