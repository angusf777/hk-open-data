import type {
  ApprovalStatus,
  AuditEntry,
  CanonicalEvent,
  FreshnessStatus,
  LocalizedText,
  Incident,
  MonitorTarget,
  MonitorTargetDetail,
  SourceApprovalDecision,
  SourceDefinition,
  SourceRecord,
  StatusSummary,
  Visibility,
  JsonValue,
} from "./domain.js";

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ListSourcesInput {
  visibility: Visibility;
  limit: number;
  cursor?: string | undefined;
  project?: string | undefined;
  authorityClass?: string | undefined;
  freshnessStatus?: FreshnessStatus | undefined;
  approvalStatus?: ApprovalStatus | undefined;
}

export interface ListAuditInput {
  targetId?: string | undefined;
  limit: number;
  cursor?: string | undefined;
}

export interface ReadPageInput {
  limit: number;
  cursor?: string | undefined;
}

export interface ListSourceRecordsInput extends ReadPageInput {
  sourceId?: string | undefined;
  observedFrom?: string | undefined;
  observedTo?: string | undefined;
  publishedFrom?: string | undefined;
  publishedTo?: string | undefined;
  language?: string | undefined;
}

export interface ListEventsInput extends ReadPageInput {
  eventType?: string | undefined;
  status?: string | undefined;
  severity?: string | undefined;
  observedFrom?: string | undefined;
  observedTo?: string | undefined;
  affectedEntity?: string | undefined;
}

export interface ListMonitorTargetsInput extends ReadPageInput {
  visibility: Visibility;
  provider?: string | undefined;
  sourceId?: string | undefined;
  outcome?: string | undefined;
}

export interface ListIncidentsInput extends ReadPageInput {
  visibility: Visibility;
  status?: string | undefined;
  severity?: string | undefined;
  sourceId?: string | undefined;
  openedFrom?: string | undefined;
  openedTo?: string | undefined;
}

export interface StatusSummaryInput {
  project?: string | undefined;
  provider?: string | undefined;
}

export interface OperationalMetrics {
  schedulerBacklog: number;
  delayedChecks: number;
  staleConnectors: number;
  failedWebhooks: number;
}

export interface VersionExpectation {
  expectedVersion: number;
}

export interface IncidentActionInput {
  incidentId: string;
  actor: string;
  reason: string;
  occurredAt: string;
}

export interface SuppressIncidentInput extends IncidentActionInput {
  expiresAt: string;
}

export interface ResolveIncidentInput extends IncidentActionInput {
  cause: string;
  evidenceObservationIds: string[];
}

export interface PublishIncidentInput extends IncidentActionInput {
  publicSummary: LocalizedText;
}

export interface CorrectIncidentInput extends PublishIncidentInput {
  correctionReference: string;
}

export interface ActivateMonitorInput {
  monitorId: string;
  actor: string;
  reason: string;
  occurredAt: string;
  operatorIdentity: string;
  ruleVersion: string;
  publicVisibility: "public" | "private";
  evidenceObservationIds: string[];
  freshnessRule: string;
  contentRules: { [key: string]: JsonValue };
}

export interface ActivateConnectorInput {
  sourceId: string;
  sourceGroupId: string;
  connectorId: string;
  codeVersion: string;
  endpoint: string;
  method: "GET" | "POST";
  requestBody: { [key: string]: JsonValue } | null;
  project: string;
  purpose: string;
  timeoutMs: number;
  maxResponseBytes: number;
  maxCompressedResponseBytes: number;
  maxAttempts: number;
  pagination: { next_url_pointer: string; max_pages: number } | null;
  cadenceSeconds: number;
  fixtureEvidenceUrl: string;
  liveProbeEvidenceUrl: string;
  actor: string;
  reason: string;
  occurredAt: string;
}

export type RepositoryErrorCode =
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "INVALID_CURSOR"
  | "INVALID_STATE";

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string) {
    super(message);
    this.name = "RepositoryError";
    this.code = code;
  }
}

export interface PlatformRepository {
  healthCheck(): Promise<void>;
  metricsSnapshot(now: string): Promise<OperationalMetrics>;
  listSources(input: ListSourcesInput): Promise<Page<SourceDefinition>>;
  getSource(sourceId: string, visibility: Visibility): Promise<SourceDefinition | null>;
  listSourceRecords(input: ListSourceRecordsInput): Promise<Page<SourceRecord>>;
  getSourceRecord(sourceRecordId: string): Promise<SourceRecord | null>;
  listEvents(input: ListEventsInput): Promise<Page<CanonicalEvent>>;
  getEvent(eventId: string): Promise<CanonicalEvent | null>;
  listMonitorTargets(input: ListMonitorTargetsInput): Promise<Page<MonitorTarget>>;
  getMonitorTarget(
    monitorId: string,
    visibility: Visibility,
    historyLimit: number,
  ): Promise<MonitorTargetDetail | null>;
  listIncidents(input: ListIncidentsInput): Promise<Page<Incident>>;
  getIncident(incidentId: string, visibility: Visibility): Promise<Incident | null>;
  getStatusSummary(generatedAt: string, input?: StatusSummaryInput): Promise<StatusSummary>;
  decideSourceApproval(
    decision: SourceApprovalDecision,
    version: VersionExpectation,
  ): Promise<SourceDefinition>;
  activateMonitorTarget(
    input: ActivateMonitorInput,
    version: VersionExpectation,
  ): Promise<MonitorTarget>;
  activateConnector(
    input: ActivateConnectorInput,
    version: VersionExpectation,
  ): Promise<SourceDefinition>;
  acknowledgeIncident(input: IncidentActionInput, version: VersionExpectation): Promise<Incident>;
  suppressIncident(input: SuppressIncidentInput, version: VersionExpectation): Promise<Incident>;
  resolveIncident(input: ResolveIncidentInput, version: VersionExpectation): Promise<Incident>;
  publishIncident(input: PublishIncidentInput, version: VersionExpectation): Promise<Incident>;
  correctIncident(input: CorrectIncidentInput, version: VersionExpectation): Promise<Incident>;
  listAudit(input: ListAuditInput): Promise<Page<AuditEntry>>;
}
