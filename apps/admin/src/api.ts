import { HKDataClient, type ApiObject, type SourceSummary } from "@hk-open-data/sdk-typescript";

export interface AdminSource {
  id: string;
  sourceGroupId: string | null;
  name: string;
  provider: string;
  approval: string;
  freshness: string;
  lastSuccess: string | null;
  version: number;
  termsEvidenceState?: string | undefined;
}

export interface AdminTarget {
  id: string;
  sourceId: string;
  provider: string;
  outcome: string;
  lastChecked: string | null;
  activation: string;
  publicVisibility: string;
  baselineVersion: number | null;
  version: number;
}

export interface AdminIncident {
  id: string;
  sourceId: string;
  severity: string;
  status: string;
  openedAt: string;
  version: number;
  summary: string;
  publicState: string;
}

export interface AdminDelivery {
  id: string;
  eventType: string;
  endpoint: string;
  status: string;
  attempts: number;
  nextAttempt: string | null;
}

export interface AdminAudit {
  id: string;
  actor: string;
  action: string;
  targetId: string;
  reason: string;
  occurredAt: string;
}

export interface AdminApi {
  listSources(): Promise<AdminSource[]>;
  listTargets(): Promise<AdminTarget[]>;
  listIncidents(): Promise<AdminIncident[]>;
  listDeliveries(): Promise<AdminDelivery[]>;
  listAudit(): Promise<AdminAudit[]>;
  decideSource(sourceId: string, version: number, input: ApiObject): Promise<void>;
  activateTarget(monitorId: string, version: number, input: ApiObject): Promise<void>;
  activateConnector(sourceId: string, version: number, input: ApiObject): Promise<void>;
  actOnIncident(incidentId: string, action: "acknowledge" | "suppress" | "resolve" | "publish" | "correct", version: number, input: ApiObject): Promise<void>;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value !== "" ? value : fallback;
}

function number(value: unknown, fallback = 1): number {
  return typeof value === "number" ? value : fallback;
}

function source(item: SourceSummary): AdminSource {
  return {
    id: item.source_id,
    sourceGroupId: typeof item["source_group_id"] === "string" ? item["source_group_id"] : null,
    name: text(item.name, item.source_id),
    provider: text(item.provider, "Provider not listed"),
    approval: text(item.approval_status, "pending"),
    freshness: text(item.freshness_status, "unknown"),
    lastSuccess: typeof item["last_success_at"] === "string" ? item["last_success_at"] : null,
    version: number(item["version"]),
    termsEvidenceState: item.terms_evidence_state,
  };
}

export function createLiveAdminApi(options: { baseUrl: string }): AdminApi {
  const client = new HKDataClient(options);
  return {
    async listSources() {
      return (await client.listAllSources({ limit: 200 })).map(source);
    },
    async listTargets() {
      const page = await client.listMonitorTargets({ limit: 200 });
      return page.items.map((item) => ({
        id: text(item["monitor_id"], "Unknown target"),
        sourceId: text(item["source_id"], "Unknown source"),
        provider: text(item["provider"], "Provider not listed"),
        outcome: text(item["outcome"], "unknown"),
        lastChecked: typeof item["last_checked_at"] === "string" ? item["last_checked_at"] : null,
        activation: text(item["activation_status"], "specified_pending_approval"),
        publicVisibility: text(item["public_visibility"], "pending_review"),
        baselineVersion:
          typeof item["baseline_version"] === "number" ? item["baseline_version"] : null,
        version: number(item["version"]),
      }));
    },
    async listIncidents() {
      const page = await client.listIncidents({ limit: 200 });
      return page.items.map((item) => ({
        id: text(item["incident_id"], "Unknown incident"),
        sourceId: text(item["source_id"], "Unknown source"),
        severity: text(item["severity"], "unknown"),
        status: text(item["status"], "unknown"),
        openedAt: text(item["opened_at"], new Date(0).toISOString()),
        version: number(item["audit_version"]),
        summary: text(
          item["internal_summary"] ??
            (typeof item["public_summary"] === "object" && item["public_summary"] !== null
              ? (item["public_summary"] as ApiObject)["en"]
              : item["public_summary"]),
          "No reviewed summary",
        ),
        publicState: text(item["public_state"], "private"),
      }));
    },
    async listDeliveries() {
      const result = await client.listWebhookDeliveries({ limit: 200 });
      return result.items.map((item) => ({
        id: text(item["delivery_attempt_id"], "Unknown delivery"),
        eventType: text(item["event_type"], "unknown"),
        endpoint: text(item["endpoint"], "Endpoint not listed"),
        status: text(item["status"], "unknown"),
        attempts: number(item["attempt_number"], 0),
        nextAttempt: typeof item["next_attempt_at"] === "string" ? item["next_attempt_at"] : null,
      }));
    },
    async listAudit() {
      const result = await client.listAudit({ limit: 200 });
      return result.items.map((item) => ({
        id: text(item["audit_id"], "Unknown audit entry"),
        actor: text(item["actor"], "Unknown actor"),
        action: text(item["action"], "unknown"),
        targetId: text(item["target_id"], "Unknown target"),
        reason: text(item["reason"], "No reason recorded"),
        occurredAt: text(item["occurred_at"], new Date(0).toISOString()),
      }));
    },
    async decideSource(sourceId, version, input) {
      await client.decideSourceApproval(sourceId, version, input);
    },
    async activateTarget(monitorId, version, input) {
      await client.activateMonitorTarget(monitorId, version, input);
    },
    async activateConnector(sourceId, version, input) {
      await client.activateConnector(sourceId, version, input);
    },
    async actOnIncident(incidentId, action, version, input) {
      await client.actOnIncident(incidentId, action, version, input);
    },
  };
}

const fixtureSources: AdminSource[] = [
  { id: "HKAPI-001", sourceGroupId: "P01-SG-01", name: "DATA.GOV.HK CKAN", provider: "Digital Policy Office", approval: "approved", freshness: "fresh", lastSuccess: "2026-08-28T10:18:00Z", version: 2, termsEvidenceState: "official-terms-linked" },
  { id: "HKAPI-016", sourceGroupId: "P01-SG-05", name: "Hong Kong Observatory", provider: "Hong Kong Observatory", approval: "approved", freshness: "fresh", lastSuccess: "2026-08-28T10:20:00Z", version: 3, termsEvidenceState: "official-terms-linked" },
  { id: "HKAPI-021", sourceGroupId: "P01-SG-04", name: "CSDI WFS", provider: "Lands Department", approval: "approved", freshness: "stale", lastSuccess: "2026-08-28T07:12:00Z", version: 4, termsEvidenceState: "restriction-identified" },
  { id: "HKAPI-033", sourceGroupId: null, name: "MTR service data", provider: "MTR Corporation", approval: "pending", freshness: "fresh", lastSuccess: "2026-08-28T10:17:00Z", version: 1, termsEvidenceState: "ambiguity-identified" },
  { id: "HKAPI-041", sourceGroupId: "P01-SG-07", name: "HKMA Daily Series", provider: "Hong Kong Monetary Authority", approval: "approved", freshness: "fresh", lastSuccess: "2026-08-28T10:05:00Z", version: 2, termsEvidenceState: "official-terms-linked" },
];

export function createFixtureAdminApi(): AdminApi {
  return {
    async listSources() { return structuredClone(fixtureSources); },
    async listTargets() { return [{ id: "P14-M001", sourceId: "HKAPI-001", provider: "Digital Policy Office", outcome: "pass", lastChecked: "2026-08-28T10:20:00Z", activation: "approved", publicVisibility: "public", baselineVersion: 1, version: 2 }]; },
    async listIncidents() { return [{ id: "INC-2026-000143", sourceId: "HKAPI-021", severity: "major", status: "open", openedAt: "2026-08-28T09:14:00Z", version: 2, summary: "Required field removed from the reviewed WFS schema.", publicState: "review_required" }]; },
    async listDeliveries() { return [{ id: "DEL-000001", eventType: "source.changed", endpoint: "subscriber endpoint", status: "retry", attempts: 2, nextAttempt: "2026-08-28T10:30:00Z" }]; },
    async listAudit() { return [{ id: "AUD-000001", actor: "source-reviewer", action: "source.approved", targetId: "HKAPI-001", reason: "Rights evidence reviewed", occurredAt: "2026-08-28T09:00:00Z" }]; },
    async decideSource() { return undefined; },
    async activateTarget() { return undefined; },
    async activateConnector() { return undefined; },
    async actOnIncident() { return undefined; },
  };
}
