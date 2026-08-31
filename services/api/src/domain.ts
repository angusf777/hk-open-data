export type ApprovalStatus =
  | "specified_pending_approval"
  | "approved"
  | "restricted"
  | "rejected"
  | "revoked"
  | "expired";

export type FreshnessStatus = "fresh" | "stale" | "unknown" | "not_applicable";
export type Visibility = "public" | "private";
export type TermsEvidenceState =
  | "not-reviewed"
  | "official-terms-linked"
  | "restriction-identified"
  | "ambiguity-identified"
  | "provider-confirmation-recorded";

export interface SourceDefinition {
  sourceId: string;
  catalogueId?: string;
  catalogueVerifiedAt?: string;
  termsEvidenceState?: TermsEvidenceState;
  sourceGroupId?: string | null;
  projects: string[];
  name: string;
  provider: string;
  authorityClass: string;
  approvalStatus: ApprovalStatus;
  visibility: Visibility;
  freshnessStatus: FreshnessStatus;
  lastSuccessAt: string | null;
  documentationUrl: string | null;
  cadence: string;
  approvedUses: string[];
  limitations: string[];
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SourceApprovalDecision {
  sourceId: string;
  decision: "approved" | "restricted" | "rejected" | "revoked";
  projects: string[];
  purposes: string[];
  storage: string;
  retention: string;
  redistribution: string;
  attribution: string;
  evidenceUrls: string[];
  expiresAt: string;
  reason: string;
  actor: string;
  decidedAt: string;
}

export interface AuditEntry {
  auditId: string;
  actor: string;
  action:
    | "source.approval_decided"
    | "monitor.activated"
    | "connector.activated"
    | "scheduler.blocked"
    | "incident.acknowledged"
    | "incident.suppressed"
    | "incident.resolved"
    | "incident.published"
    | "incident.corrected";
  targetType: "source_definition" | "connector_definition" | "monitor_target" | "scheduler_job" | "incident";
  targetId: string;
  reason: string;
  beforeHash: string;
  afterHash: string;
  occurredAt: string;
  metadata: { [key: string]: JsonValue };
}

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface LocalizedText {
  en: string | null;
  zhHant: string | null;
  zhHans?: string | null;
}

export interface SourceRecord {
  sourceRecordId: string;
  sourceId: string;
  catalogueId?: string;
  termsEvidenceState?: TermsEvidenceState;
  evidenceMode?: "digest" | "raw";
  sourceGroupId: string;
  provider: string;
  authorityClass: "official" | "contracted" | "community" | "derived" | "model_generated" | "synthetic";
  retrievedAt: string;
  contentType: string;
  rawPayloadHash: string;
  rawStorageUri: string;
  approvalReference: string;
  schemaVersion: string;
  freshnessStatus: "fresh" | "aging" | "stale" | "expired" | "unknown";
  qualityFlags: string[];
  parentRecordIds: string[];
  recordKey?: string | null;
  sourceName?: string | null;
  sourceUrl?: string | null;
  documentationUrl?: string | null;
  observedAt?: string | null;
  publishedAt?: string | null;
  effectiveAt?: string | null;
  expiresAt?: string | null;
  language?: string | null;
  rightsReference?: string | null;
  attribution?: string | null;
  schemaFingerprint?: string | null;
  transformVersion?: string | null;
}

export interface CanonicalEvent {
  eventId: string;
  eventType:
    | "source.new"
    | "source.changed"
    | "source.removed"
    | "source.suspended"
    | "warning.issued"
    | "warning.updated"
    | "warning.cancelled"
    | "threshold.exceeded"
    | "route.disrupted"
    | "service.disrupted"
    | "licence.changed"
    | "legislation.changed"
    | "bill.changed"
    | "facility.availability_changed";
  status: "anticipated" | "active" | "updated" | "resolved" | "cancelled" | "historical";
  severity: "informational" | "minor" | "moderate" | "major" | "critical" | "unknown";
  title: LocalizedText;
  summary: LocalizedText;
  sourceRecords: string[];
  observedAt: string;
  qualityFlags: string[];
  schemaVersion: string;
  affectedEntities?: string[];
  startedAt?: string | null;
  expectedEndAt?: string | null;
  expiresAt?: string | null;
}

export type MonitorOutcome = "pass" | "degraded" | "fail" | "maintenance" | "suppressed" | "unknown";

export interface MonitorTarget {
  monitorId: string;
  sourceId: string;
  provider: string;
  name: string;
  outcome: MonitorOutcome;
  lastCheckedAt: string | null;
  publicVisibility: "public" | "private" | "pending_review" | "private_until_review";
  baselineVersion: number | null;
  activationStatus?: "specified_pending_approval" | "approved" | "suspended" | "retired";
  operatorIdentity?: string | null;
  ruleVersion?: string | null;
  version?: number;
}

export interface MonitorCheckResult {
  check: "availability" | "media" | "contract" | "freshness" | "schema" | "semantic" | "bilingual" | "geometry" | "redirect" | "hash";
  outcome: "pass" | "degraded" | "fail" | "not_applicable" | "unknown";
  code: string;
  message?: string | null;
}

export interface MonitorObservation {
  observationId: string;
  monitorId: string;
  startedAt: string;
  finishedAt: string;
  outcome: MonitorOutcome;
  checkResults: MonitorCheckResult[];
  latencyMs: number;
  evidenceHash: string;
  baselineVersion: string;
  seededFailure: boolean;
  httpStatus?: number | null;
  providerTimestamp?: string | null;
  freshnessAgeSeconds?: number | null;
  contentHash?: string | null;
  schemaFingerprint?: string | null;
  connectorRunId?: string | null;
  correlationId?: string | null;
}

export interface Incident {
  incidentId: string;
  sourceId: string;
  status: "candidate" | "open" | "acknowledged" | "monitoring" | "resolved" | "suppressed";
  severity: "minor" | "moderate" | "major" | "critical";
  category: "availability" | "freshness" | "contract" | "schema" | "semantic" | "bilingual" | "geometry" | "security" | "delivery";
  monitorIds: string[];
  observationIds: string[];
  openedAt: string;
  lastObservedAt: string;
  publicState: "private" | "review_required" | "published" | "corrected" | "withdrawn";
  auditVersion: number;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  suppressionReason?: string | null;
  suppressionExpiresAt?: string | null;
  internalSummary?: string | null;
  publicSummary?: LocalizedText | null;
  cause?: string | null;
  correctionReference?: string | null;
}

export interface MonitorTargetDetail {
  target: MonitorTarget;
  observations: MonitorObservation[];
  incidents: Incident[];
}

export interface StatusSummary {
  generatedAt: string;
  overall: "operational" | "degraded" | "major_outage" | "unknown";
  counts: Record<string, number>;
  currentIncidents: Incident[];
}
