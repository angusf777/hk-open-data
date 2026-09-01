import { createHash } from "node:crypto";

import type { QueryResultRow } from "pg";

import type {
  AuditEntry,
  CanonicalEvent,
  Incident,
  LocalizedText,
  MonitorObservation,
  MonitorTarget,
  MonitorTargetDetail,
  SourceApprovalDecision,
  SourceDefinition,
  SourceRecord,
  StatusSummary,
  Visibility,
} from "./domain.js";
import type { PostgresClient, PostgresPool } from "./postgres.js";
import type {
  ActivateConnectorInput,
  ActivateMonitorInput,
  ListAuditInput,
  ListEventsInput,
  ListIncidentsInput,
  ListMonitorTargetsInput,
  ListSourcesInput,
  ListSourceRecordsInput,
  Page,
  OperationalMetrics,
  PlatformRepository,
  IncidentActionInput,
  CorrectIncidentInput,
  PublishIncidentInput,
  ResolveIncidentInput,
  StatusSummaryInput,
  SuppressIncidentInput,
  VersionExpectation,
} from "./repository.js";
import { RepositoryError } from "./repository.js";

interface SourceRow extends QueryResultRow {
  source_id: string;
  catalogue_id: string | null;
  catalogue_verified_at: Date | string | null;
  terms_evidence_state: NonNullable<SourceDefinition["termsEvidenceState"]> | null;
  source_group_id: string | null;
  projects: string[];
  name: string;
  provider: string;
  authority_class: string;
  approval_status: SourceDefinition["approvalStatus"];
  visibility: SourceDefinition["visibility"];
  freshness_status: SourceDefinition["freshnessStatus"];
  last_success_at: Date | string | null;
  documentation_url: string | null;
  cadence: string;
  approved_uses: string[];
  limitations: string[];
  version: number;
  created_at: Date | string;
  updated_at: Date | string;
}

interface AuditRow extends QueryResultRow {
  audit_id: string;
  actor: string;
  action: AuditEntry["action"];
  target_type: AuditEntry["targetType"];
  target_id: string;
  reason: string;
  before_hash: string;
  after_hash: string;
  occurred_at: Date | string;
  metadata: AuditEntry["metadata"];
}

interface SourceRecordRow extends QueryResultRow {
  source_record_id: string;
  source_id: string;
  catalogue_id: string | null;
  terms_evidence_state: NonNullable<SourceRecord["termsEvidenceState"]> | null;
  source_group_id: string | null;
  provider: string;
  authority_class: SourceRecord["authorityClass"];
  retrieved_at: Date | string;
  observed_at: Date | string | null;
  published_at: Date | string | null;
  language: string | null;
  media_type: string;
  sha256: string;
  object_uri: string;
  approval_reference: string;
  schema_version: string;
  freshness_status: SourceRecord["freshnessStatus"];
  quality_flags: string[];
  parent_source_record_ids: string[];
}

interface EventRow extends QueryResultRow {
  canonical_event_id: string;
  event_type: CanonicalEvent["eventType"];
  status: CanonicalEvent["status"];
  severity: CanonicalEvent["severity"];
  observed_at: Date | string;
  effective_at: Date | string | null;
  expires_at: Date | string | null;
  event_data: {
    title: { en: string | null; zh_Hant: string | null; zh_Hans?: string | null };
    summary: { en: string | null; zh_Hant: string | null; zh_Hans?: string | null };
    affected_entities?: string[];
    quality_flags: string[];
    schema_version: string;
  };
  evidence_source_record_ids: string[];
}

interface MonitorTargetRow extends QueryResultRow {
  monitor_id: string;
  source_id: string;
  provider: string;
  name: string;
  public_visibility: MonitorTarget["publicVisibility"];
  activation_status: NonNullable<MonitorTarget["activationStatus"]>;
  operator_identity: string | null;
  rule_version: string | null;
  version: number;
  cadence_seconds: number;
}

interface EffectiveApprovalRow extends QueryResultRow {
  decision: SourceApprovalDecision["decision"];
  projects: string[];
  purposes: string[];
  decided_at: Date | string;
  expires_at: Date | string;
}

interface OperationalMetricsRow extends QueryResultRow {
  scheduler_backlog: number;
  delayed_checks: number;
  stale_connectors: number;
  failed_webhooks: number;
}

interface LatestObservationRow extends QueryResultRow {
  outcome: MonitorTarget["outcome"];
  started_at: Date | string;
}

interface BaselineVersionRow extends QueryResultRow {
  baseline_version: number;
}

interface ObservationRow extends QueryResultRow {
  observation_id: string;
  monitor_id: string;
  outcome: MonitorObservation["outcome"];
  started_at: Date | string;
  finished_at: Date | string;
  latency_ms: number;
  http_status: number | null;
  provider_timestamp: Date | string | null;
  freshness_age_seconds: number | null;
  content_hash: string | null;
  schema_fingerprint: string | null;
  connector_run_id: string | null;
  evidence_json: {
    evidence_hash: string;
    baseline_version: string;
    seeded_failure: boolean;
    check_results: MonitorObservation["checkResults"];
    correlation_id?: string | null;
  };
}

interface IncidentRow extends QueryResultRow {
  incident_id: string;
  source_id: string;
  status: Incident["status"];
  severity: Incident["severity"];
  category: Incident["category"];
  monitor_ids: string[];
  observation_ids: string[];
  opened_at: Date | string;
  last_observed_at: Date | string;
  acknowledged_at: Date | string | null;
  acknowledged_by: string | null;
  resolved_at: Date | string | null;
  resolved_by: string | null;
  suppression_reason: string | null;
  suppression_expires_at: Date | string | null;
  internal_summary: string | null;
  public_state: Incident["publicState"];
  public_summary: { en: string | null; zh_Hant: string | null } | null;
  cause: string | null;
  correction_reference: string | null;
  audit_version: number;
}

function timestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function sourceFromRow(row: SourceRow): SourceDefinition {
  return {
    sourceId: row.source_id,
    ...(row.catalogue_id === null ? {} : { catalogueId: row.catalogue_id }),
    ...(row.catalogue_verified_at === null
      ? {}
      : { catalogueVerifiedAt: timestamp(row.catalogue_verified_at).slice(0, 10) }),
    ...(row.terms_evidence_state === null
      ? {}
      : { termsEvidenceState: row.terms_evidence_state }),
    sourceGroupId: row.source_group_id,
    projects: row.projects,
    name: row.name,
    provider: row.provider,
    authorityClass: row.authority_class,
    approvalStatus: row.approval_status,
    visibility: row.visibility,
    freshnessStatus: row.freshness_status,
    lastSuccessAt: row.last_success_at === null ? null : timestamp(row.last_success_at),
    documentationUrl: row.documentation_url,
    cadence: row.cadence,
    approvedUses: row.approved_uses,
    limitations: row.limitations,
    version: row.version,
    createdAt: timestamp(row.created_at),
    updatedAt: timestamp(row.updated_at),
  };
}

function auditFromRow(row: AuditRow): AuditEntry {
  return {
    auditId: row.audit_id,
    actor: row.actor,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    reason: row.reason,
    beforeHash: row.before_hash,
    afterHash: row.after_hash,
    occurredAt: timestamp(row.occurred_at),
    metadata: row.metadata,
  };
}

function localizedFromRow(value: {
  en: string | null;
  zh_Hant: string | null;
  zh_Hans?: string | null;
}): LocalizedText {
  return {
    en: value.en,
    zhHant: value.zh_Hant,
    ...(value.zh_Hans === undefined ? {} : { zhHans: value.zh_Hans }),
  };
}

function sourceRecordFromRow(row: SourceRecordRow): SourceRecord {
  return {
    sourceRecordId: row.source_record_id,
    sourceId: row.source_id,
    ...(row.catalogue_id === null ? {} : { catalogueId: row.catalogue_id }),
    ...(row.terms_evidence_state === null
      ? {}
      : { termsEvidenceState: row.terms_evidence_state }),
    evidenceMode: row.object_uri.startsWith("digest://") ? "digest" : "raw",
    sourceGroupId: row.source_group_id ?? "P14-ONLY-01",
    provider: row.provider,
    authorityClass: row.authority_class,
    retrievedAt: timestamp(row.retrieved_at),
    observedAt: row.observed_at === null ? null : timestamp(row.observed_at),
    publishedAt: row.published_at === null ? null : timestamp(row.published_at),
    language: row.language,
    contentType: row.media_type,
    rawPayloadHash: row.sha256,
    rawStorageUri: row.object_uri,
    approvalReference: row.approval_reference,
    schemaVersion: row.schema_version,
    freshnessStatus: row.freshness_status,
    qualityFlags: row.quality_flags,
    parentRecordIds: row.parent_source_record_ids,
  };
}

function eventFromRow(row: EventRow): CanonicalEvent {
  return {
    eventId: row.canonical_event_id,
    eventType: row.event_type,
    status: row.status,
    severity: row.severity,
    title: localizedFromRow(row.event_data.title),
    summary: localizedFromRow(row.event_data.summary),
    sourceRecords: row.evidence_source_record_ids,
    observedAt: timestamp(row.observed_at),
    qualityFlags: row.event_data.quality_flags,
    schemaVersion: row.event_data.schema_version,
    ...(row.event_data.affected_entities === undefined
      ? {}
      : { affectedEntities: row.event_data.affected_entities }),
    ...(row.effective_at === null ? {} : { startedAt: timestamp(row.effective_at) }),
    ...(row.expires_at === null ? {} : { expiresAt: timestamp(row.expires_at) }),
  };
}

function observationFromRow(row: ObservationRow): MonitorObservation {
  return {
    observationId: row.observation_id,
    monitorId: row.monitor_id,
    outcome: row.outcome,
    startedAt: timestamp(row.started_at),
    finishedAt: timestamp(row.finished_at),
    latencyMs: row.latency_ms,
    httpStatus: row.http_status,
    providerTimestamp:
      row.provider_timestamp === null ? null : timestamp(row.provider_timestamp),
    freshnessAgeSeconds: row.freshness_age_seconds,
    contentHash: row.content_hash,
    schemaFingerprint: row.schema_fingerprint,
    connectorRunId: row.connector_run_id,
    evidenceHash: row.evidence_json.evidence_hash,
    baselineVersion: row.evidence_json.baseline_version,
    seededFailure: row.evidence_json.seeded_failure,
    checkResults: row.evidence_json.check_results,
    ...(row.evidence_json.correlation_id === undefined
      ? {}
      : { correlationId: row.evidence_json.correlation_id }),
  };
}

function incidentFromRow(row: IncidentRow): Incident {
  return {
    incidentId: row.incident_id,
    sourceId: row.source_id,
    status: row.status,
    severity: row.severity,
    category: row.category,
    monitorIds: row.monitor_ids,
    observationIds: row.observation_ids,
    openedAt: timestamp(row.opened_at),
    lastObservedAt: timestamp(row.last_observed_at),
    acknowledgedAt: row.acknowledged_at === null ? null : timestamp(row.acknowledged_at),
    acknowledgedBy: row.acknowledged_by,
    resolvedAt: row.resolved_at === null ? null : timestamp(row.resolved_at),
    resolvedBy: row.resolved_by,
    suppressionReason: row.suppression_reason,
    suppressionExpiresAt:
      row.suppression_expires_at === null ? null : timestamp(row.suppression_expires_at),
    internalSummary: row.internal_summary,
    publicState: row.public_state,
    publicSummary:
      row.public_summary === null ? null : localizedFromRow(row.public_summary),
    cause: row.cause,
    correctionReference: row.correction_reference,
    auditVersion: row.audit_version,
  };
}

function digest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function cursorAfter(cursor: string | undefined): string | null {
  if (cursor === undefined) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("after" in parsed) ||
      typeof parsed.after !== "string" ||
      parsed.after === ""
    ) {
      throw new Error("invalid key");
    }
    return parsed.after;
  } catch {
    throw new RepositoryError("INVALID_CURSOR", "Cursor is invalid or expired");
  }
}

function cursorPage<T>(items: T[], limit: number, key: (item: T) => string): Page<T> {
  const hasMore = items.length > limit;
  const selected = items.slice(0, limit);
  const last = selected.at(-1);
  return {
    items: selected,
    nextCursor: hasMore && last !== undefined
      ? Buffer.from(JSON.stringify({ after: key(last) }), "utf8").toString("base64url")
      : null,
  };
}

async function rollback(client: PostgresClient): Promise<void> {
  try {
    await client.query("ROLLBACK");
  } catch {
    // The original transactional error is the actionable failure.
  }
}

class PostgresPlatformRepository implements PlatformRepository {
  readonly #pool: PostgresPool;

  constructor(pool: PostgresPool) {
    this.#pool = pool;
  }

  async healthCheck(): Promise<void> {
    await this.#pool.query("SELECT 1");
  }

  async metricsSnapshot(now: string): Promise<OperationalMetrics> {
    const result = await this.#pool.query<OperationalMetricsRow>(
      `SELECT
        (SELECT count(*)::int FROM scheduler_job
         WHERE active = true AND due_at < $1::timestamptz - interval '5 minutes')
          AS scheduler_backlog,
        (SELECT count(*)::int
         FROM monitor_target AS target
         LEFT JOIN LATERAL (
           SELECT max(started_at) AS checked_at FROM monitor_observation
           WHERE monitor_id = target.monitor_id
         ) AS observation ON true
         WHERE target.activation_status = 'approved'
           AND (observation.checked_at IS NULL OR
                observation.checked_at < $1::timestamptz - make_interval(secs => target.cadence_seconds)))
          AS delayed_checks,
        (SELECT count(*)::int
         FROM connector_definition AS connector
         JOIN scheduler_job AS job
           ON job.job_type = 'connector' AND job.target_id = connector.connector_id
         WHERE connector.enabled = true AND job.active = true
           AND NOT EXISTS (
             SELECT 1 FROM connector_run AS run
             WHERE run.connector_id = connector.connector_id AND run.status = 'success'
               AND run.finished_at >= $1::timestamptz - make_interval(secs => job.cadence_seconds)
           )) AS stale_connectors,
        (SELECT count(*)::int FROM delivery_attempt
         WHERE status IN ('retry', 'dead_letter')) AS failed_webhooks`,
      [now],
    );
    const row = result.rows[0]!;
    return {
      schedulerBacklog: row.scheduler_backlog,
      delayedChecks: row.delayed_checks,
      staleConnectors: row.stale_connectors,
      failedWebhooks: row.failed_webhooks,
    };
  }

  async listSources(input: ListSourcesInput): Promise<Page<SourceDefinition>> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
      throw new RangeError("limit must be an integer from 1 to 200");
    }
    const after = cursorAfter(input.cursor);
    const result = await this.#pool.query<SourceRow>(
      `SELECT * FROM source_definition
       WHERE ($1 = 'private' OR (visibility = 'public' AND approval_status = 'approved'))
         AND ($2::text IS NULL OR $2 = ANY(projects))
         AND ($3::text IS NULL OR authority_class = $3)
         AND ($4::text IS NULL OR freshness_status = $4)
         AND ($5::text IS NULL OR approval_status = $5)
         AND ($6::text IS NULL OR source_id > $6)
       ORDER BY source_id
       LIMIT $7`,
      [
        input.visibility,
        input.project ?? null,
        input.authorityClass ?? null,
        input.freshnessStatus ?? null,
        input.approvalStatus ?? null,
        after,
        input.limit + 1,
      ],
    );
    return cursorPage(result.rows.map(sourceFromRow), input.limit, (source) => source.sourceId);
  }

  async getSource(sourceId: string, visibility: Visibility): Promise<SourceDefinition | null> {
    const result = await this.#pool.query<SourceRow>(
      `SELECT * FROM source_definition
       WHERE source_id = $1
         AND ($2 = 'private' OR (visibility = 'public' AND approval_status = 'approved'))`,
      [sourceId, visibility],
    );
    const row = result.rows[0];
    return row === undefined ? null : sourceFromRow(row);
  }

  async listSourceRecords(input: ListSourceRecordsInput): Promise<Page<SourceRecord>> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
      throw new RangeError("limit must be an integer from 1 to 200");
    }
    const after = cursorAfter(input.cursor);
    const result = await this.#pool.query<SourceRecordRow>(
      `SELECT sr.*, sd.source_group_id, sd.provider, sd.authority_class,
              sd.catalogue_id, sd.terms_evidence_state,
              ro.media_type, ro.sha256, ro.object_uri
       FROM source_record sr
       JOIN source_definition sd ON sd.source_id = sr.source_id
       JOIN raw_object ro ON ro.raw_object_id = sr.raw_object_id
       WHERE ($1::text IS NULL OR sr.source_id = $1)
         AND ($2::timestamptz IS NULL OR sr.observed_at >= $2)
         AND ($3::timestamptz IS NULL OR sr.observed_at <= $3)
         AND ($4::timestamptz IS NULL OR sr.published_at >= $4)
         AND ($5::timestamptz IS NULL OR sr.published_at <= $5)
         AND ($6::text IS NULL OR sr.language = $6)
         AND ($7::text IS NULL OR sr.source_record_id > $7)
       ORDER BY sr.source_record_id
       LIMIT $8`,
      [
        input.sourceId ?? null,
        input.observedFrom ?? null,
        input.observedTo ?? null,
        input.publishedFrom ?? null,
        input.publishedTo ?? null,
        input.language ?? null,
        after,
        input.limit + 1,
      ],
    );
    return cursorPage(result.rows.map(sourceRecordFromRow), input.limit, (record) => record.sourceRecordId);
  }

  async getSourceRecord(sourceRecordId: string): Promise<SourceRecord | null> {
    const result = await this.#pool.query<SourceRecordRow>(
      `SELECT sr.*, sd.source_group_id, sd.provider, sd.authority_class,
              sd.catalogue_id, sd.terms_evidence_state,
              ro.media_type, ro.sha256, ro.object_uri
       FROM source_record sr
       JOIN source_definition sd ON sd.source_id = sr.source_id
       JOIN raw_object ro ON ro.raw_object_id = sr.raw_object_id
       WHERE sr.source_record_id = $1`,
      [sourceRecordId],
    );
    const row = result.rows[0];
    return row === undefined ? null : sourceRecordFromRow(row);
  }

  async listEvents(input: ListEventsInput): Promise<Page<CanonicalEvent>> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
      throw new RangeError("limit must be an integer from 1 to 200");
    }
    const after = cursorAfter(input.cursor);
    const values: unknown[] = [
      input.eventType ?? null,
      input.status ?? null,
      input.severity ?? null,
      input.observedFrom ?? null,
      input.observedTo ?? null,
    ];
    const affectedCondition =
      input.affectedEntity === undefined
        ? ""
        : `AND event_data->'affected_entities' ? $${values.push(input.affectedEntity)}`;
    const afterParameter = values.push(after);
    const limitParameter = values.push(input.limit + 1);
    const result = await this.#pool.query<EventRow>(
      `SELECT * FROM canonical_event
       WHERE ($1::text IS NULL OR event_type = $1)
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR severity = $3)
         AND ($4::timestamptz IS NULL OR observed_at >= $4)
         AND ($5::timestamptz IS NULL OR observed_at <= $5)
         ${affectedCondition}
         AND ($${afterParameter}::text IS NULL OR canonical_event_id > $${afterParameter})
       ORDER BY canonical_event_id
       LIMIT $${limitParameter}`,
      values,
    );
    return cursorPage(result.rows.map(eventFromRow), input.limit, (event) => event.eventId);
  }

  async getEvent(eventId: string): Promise<CanonicalEvent | null> {
    const result = await this.#pool.query<EventRow>(
      "SELECT * FROM canonical_event WHERE canonical_event_id = $1",
      [eventId],
    );
    const row = result.rows[0];
    return row === undefined ? null : eventFromRow(row);
  }

  async #targetFromRow(row: MonitorTargetRow): Promise<MonitorTarget> {
    const latest = await this.#pool.query<LatestObservationRow>(
      `SELECT outcome, started_at FROM monitor_observation
       WHERE monitor_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [row.monitor_id],
    );
    const baseline = await this.#pool.query<BaselineVersionRow>(
      `SELECT baseline_version FROM monitor_baseline
       WHERE monitor_id = $1 AND retired_at IS NULL
       ORDER BY baseline_version DESC LIMIT 1`,
      [row.monitor_id],
    );
    return {
      monitorId: row.monitor_id,
      sourceId: row.source_id,
      provider: row.provider,
      name: row.name,
      outcome: latest.rows[0]?.outcome ?? "unknown",
      lastCheckedAt:
        latest.rows[0] === undefined ? null : timestamp(latest.rows[0].started_at),
      publicVisibility: row.public_visibility,
      baselineVersion: baseline.rows[0]?.baseline_version ?? null,
      activationStatus: row.activation_status,
      operatorIdentity: row.operator_identity,
      ruleVersion: row.rule_version,
      version: row.version,
    };
  }

  async listMonitorTargets(input: ListMonitorTargetsInput): Promise<Page<MonitorTarget>> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
      throw new RangeError("limit must be an integer from 1 to 200");
    }
    const after = cursorAfter(input.cursor);
    const result = await this.#pool.query<MonitorTargetRow>(
      `SELECT * FROM monitor_target
       WHERE ($1 = 'private' OR public_visibility = 'public')
         AND ($2::text IS NULL OR provider = $2)
         AND ($3::text IS NULL OR source_id = $3)
       ORDER BY monitor_id
       LIMIT 10000`,
      [input.visibility, input.provider ?? null, input.sourceId ?? null],
    );
    const targets = await Promise.all(result.rows.map((row) => this.#targetFromRow(row)));
    const filtered =
      targets.filter(
        (target) =>
          (input.outcome === undefined || target.outcome === input.outcome) &&
          (after === null || target.monitorId > after),
      );
    return cursorPage(filtered, input.limit, (target) => target.monitorId);
  }

  async getMonitorTarget(
    monitorId: string,
    visibility: Visibility,
    historyLimit: number,
  ): Promise<MonitorTargetDetail | null> {
    const targetResult = await this.#pool.query<MonitorTargetRow>(
      `SELECT * FROM monitor_target
       WHERE monitor_id = $1 AND ($2 = 'private' OR public_visibility = 'public')`,
      [monitorId, visibility],
    );
    const targetRow = targetResult.rows[0];
    if (targetRow === undefined) {
      return null;
    }
    const observations = await this.#pool.query<ObservationRow>(
      `SELECT * FROM monitor_observation
       WHERE monitor_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [monitorId, historyLimit],
    );
    const incidents = await this.#pool.query<IncidentRow>(
      `SELECT * FROM incident
       WHERE $1 = ANY(monitor_ids)
         AND ($2 = 'private' OR public_state IN ('published', 'corrected'))
       ORDER BY opened_at DESC`,
      [monitorId, visibility],
    );
    return {
      target: await this.#targetFromRow(targetRow),
      observations: observations.rows.map(observationFromRow),
      incidents: incidents.rows.map(incidentFromRow),
    };
  }

  async listIncidents(input: ListIncidentsInput): Promise<Page<Incident>> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
      throw new RangeError("limit must be an integer from 1 to 200");
    }
    const after = cursorAfter(input.cursor);
    const result = await this.#pool.query<IncidentRow>(
      `SELECT * FROM incident
       WHERE ($1 = 'private' OR public_state IN ('published', 'corrected'))
         AND ($2::text IS NULL OR status = $2)
         AND ($3::text IS NULL OR severity = $3)
         AND ($4::text IS NULL OR source_id = $4)
         AND ($5::timestamptz IS NULL OR opened_at >= $5)
         AND ($6::timestamptz IS NULL OR opened_at <= $6)
         AND ($7::text IS NULL OR incident_id > $7)
       ORDER BY incident_id
       LIMIT $8`,
      [
        input.visibility,
        input.status ?? null,
        input.severity ?? null,
        input.sourceId ?? null,
        input.openedFrom ?? null,
        input.openedTo ?? null,
        after,
        input.limit + 1,
      ],
    );
    return cursorPage(result.rows.map(incidentFromRow), input.limit, (incident) => incident.incidentId);
  }

  async getIncident(incidentId: string, visibility: Visibility): Promise<Incident | null> {
    const result = await this.#pool.query<IncidentRow>(
      `SELECT * FROM incident
       WHERE incident_id = $1
         AND ($2 = 'private' OR public_state IN ('published', 'corrected'))`,
      [incidentId, visibility],
    );
    const row = result.rows[0];
    return row === undefined ? null : incidentFromRow(row);
  }

  async getStatusSummary(
    generatedAt: string,
    input: StatusSummaryInput = {},
  ): Promise<StatusSummary> {
    const projectSources =
      input.project === undefined
        ? null
        : new Set(
            (
              await this.listSources({
                visibility: "private",
                project: input.project,
                limit: 200,
              })
            ).items.map((source) => source.sourceId),
          );
    const targets = (
      await this.listMonitorTargets({
        visibility: "public",
        provider: input.provider,
        limit: 200,
      })
    ).items.filter((target) => projectSources === null || projectSources.has(target.sourceId));
    const visibleSourceIds = new Set(targets.map((target) => target.sourceId));
    const incidents = (
      await this.listIncidents({ visibility: "public", limit: 200 })
    ).items.filter(
      (incident) => incident.status !== "resolved" && visibleSourceIds.has(incident.sourceId),
    );
    const counts: Record<string, number> = {};
    for (const target of targets) {
      counts[target.outcome] = (counts[target.outcome] ?? 0) + 1;
    }
    const overall = incidents.some(
      (incident) => incident.severity === "major" || incident.severity === "critical",
    )
      ? "major_outage"
      : incidents.length > 0 || targets.some((target) => target.outcome === "degraded" || target.outcome === "fail")
        ? "degraded"
        : targets.length === 0
          ? "unknown"
          : "operational";
    return { generatedAt, overall, counts, currentIncidents: incidents };
  }

  async decideSourceApproval(
    decision: SourceApprovalDecision,
    version: VersionExpectation,
  ): Promise<SourceDefinition> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const currentResult = await client.query<SourceRow>(
        "SELECT * FROM source_definition WHERE source_id = $1 FOR UPDATE",
        [decision.sourceId],
      );
      const currentRow = currentResult.rows[0];
      if (currentRow === undefined) {
        throw new RepositoryError("NOT_FOUND", `Source ${decision.sourceId} was not found`);
      }
      const current = sourceFromRow(currentRow);
      if (current.version !== version.expectedVersion) {
        throw new RepositoryError(
          "VERSION_CONFLICT",
          `Source ${decision.sourceId} is at version ${current.version}`,
        );
      }
      const approvedUses =
        decision.decision === "approved" || decision.decision === "restricted"
          ? decision.purposes
          : [];
      const updatedResult = await client.query<SourceRow>(
        `UPDATE source_definition
         SET approval_status = $2, approved_uses = $3, version = version + 1, updated_at = $4
         WHERE source_id = $1
         RETURNING *`,
        [decision.sourceId, decision.decision, approvedUses, decision.decidedAt],
      );
      const updatedRow = updatedResult.rows[0];
      if (updatedRow === undefined) {
        throw new RepositoryError("NOT_FOUND", `Source ${decision.sourceId} was not found`);
      }
      const updated = sourceFromRow(updatedRow);
      const beforeHash = digest(current);
      const afterHash = digest(updated);
      await client.query(
        `INSERT INTO source_approval (
           approval_id, source_id, decision, projects, purposes, storage_policy, retention_policy,
           redistribution_policy, attribution_policy, evidence_urls, reason, actor,
           decided_at, expires_at, source_version
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
        [
          `APP-${decision.sourceId}-${updated.version}`,
          decision.sourceId,
          decision.decision,
          decision.projects,
          decision.purposes,
          decision.storage,
          decision.retention,
          decision.redistribution,
          decision.attribution,
          decision.evidenceUrls,
          decision.reason,
          decision.actor,
          decision.decidedAt,
          decision.expiresAt,
          updated.version,
        ],
      );
      await client.query(
        `INSERT INTO audit_entry (
           audit_id, actor, action, target_type, target_id, reason, before_hash,
           after_hash, occurred_at, metadata
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          `AUD-${decision.sourceId}-${updated.version}`,
          decision.actor,
          "source.approval_decided",
          "source_definition",
          decision.sourceId,
          decision.reason,
          beforeHash,
          afterHash,
          decision.decidedAt,
          {
            evidenceUrls: decision.evidenceUrls,
            purposes: decision.purposes,
            projects: decision.projects,
            expiresAt: decision.expiresAt,
          },
        ],
      );
      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async activateMonitorTarget(
    input: ActivateMonitorInput,
    version: VersionExpectation,
  ): Promise<MonitorTarget> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const currentResult = await client.query<MonitorTargetRow>(
        "SELECT * FROM monitor_target WHERE monitor_id = $1 FOR UPDATE",
        [input.monitorId],
      );
      const current = currentResult.rows[0];
      if (current === undefined) {
        throw new RepositoryError("NOT_FOUND", `Monitor ${input.monitorId} was not found`);
      }
      if (current.version !== version.expectedVersion) {
        throw new RepositoryError(
          "VERSION_CONFLICT",
          `Monitor ${input.monitorId} is at version ${current.version}`,
        );
      }
      if (input.evidenceObservationIds.length === 0) {
        throw new RepositoryError(
          "INVALID_STATE",
          "Monitor baseline requires observation evidence",
        );
      }
      const approvalResult = await client.query<EffectiveApprovalRow>(
        `SELECT decision, projects, purposes, decided_at, expires_at
         FROM source_approval WHERE source_id = $1
         ORDER BY decided_at DESC, approval_id DESC LIMIT 1`,
        [current.source_id],
      );
      const approval = approvalResult.rows[0];
      const occurredAt = Date.parse(input.occurredAt);
      if (
        approval === undefined ||
        (approval.decision !== "approved" && approval.decision !== "restricted") ||
        !approval.projects.includes("P14") ||
        !approval.purposes.includes("quality-monitoring") ||
        Date.parse(timestamp(approval.decided_at)) > occurredAt ||
        Date.parse(timestamp(approval.expires_at)) <= occurredAt
      ) {
        throw new RepositoryError(
          "INVALID_STATE",
          "Enabling a health check requires a current source review for API monitoring",
        );
      }
      const baselineResult = await client.query<{ next_version: number } & QueryResultRow>(
        `SELECT COALESCE(MAX(baseline_version), 0)::int + 1 AS next_version
         FROM monitor_baseline WHERE monitor_id = $1`,
        [input.monitorId],
      );
      const baselineVersion = baselineResult.rows[0]?.next_version ?? 1;
      await client.query(
        `UPDATE monitor_baseline SET retired_at = $2
         WHERE monitor_id = $1 AND retired_at IS NULL`,
        [input.monitorId, input.occurredAt],
      );
      await client.query(
        `INSERT INTO monitor_baseline (
           baseline_id, monitor_id, baseline_version, content_rules, freshness_rule,
           evidence_observation_ids, operator_identity, activated_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          `BASE-${input.monitorId}-${baselineVersion}`,
          input.monitorId,
          baselineVersion,
          input.contentRules,
          input.freshnessRule,
          input.evidenceObservationIds,
          input.operatorIdentity,
          input.occurredAt,
        ],
      );
      const updatedResult = await client.query<MonitorTargetRow>(
        `UPDATE monitor_target
         SET activation_status = 'approved', operator_identity = $2, rule_version = $3,
             public_visibility = $4, version = version + 1, updated_at = $5
         WHERE monitor_id = $1 RETURNING *`,
        [
          input.monitorId,
          input.operatorIdentity,
          input.ruleVersion,
          input.publicVisibility,
          input.occurredAt,
        ],
      );
      const updated = updatedResult.rows[0]!;
      await client.query(
        `INSERT INTO scheduler_job (
           job_id, job_type, target_id, due_at, cadence_seconds, active,
           created_at, updated_at
         ) VALUES ($1, 'monitor', $2, $3, $4, true, $3, $3)
         ON CONFLICT (job_id) DO UPDATE SET
           due_at = EXCLUDED.due_at, cadence_seconds = EXCLUDED.cadence_seconds,
           active = true, lease_owner = NULL, lease_expires_at = NULL,
           last_error_code = NULL, updated_at = EXCLUDED.updated_at`,
        [`JOB-MON-${input.monitorId}`, input.monitorId, input.occurredAt, current.cadence_seconds],
      );
      await client.query(
        `INSERT INTO audit_entry (
           audit_id, actor, action, target_type, target_id, reason, before_hash,
           after_hash, occurred_at, metadata
         ) VALUES ($1, $2, 'monitor.activated', 'monitor_target', $3, $4, $5, $6, $7, $8)`,
        [
          `AUD-${input.monitorId}-${updated.version}`,
          input.actor,
          input.monitorId,
          input.reason,
          digest(current),
          digest(updated),
          input.occurredAt,
          {
            baselineVersion,
            operatorIdentity: input.operatorIdentity,
            ruleVersion: input.ruleVersion,
            evidenceObservationIds: input.evidenceObservationIds,
          },
        ],
      );
      await client.query("COMMIT");
      return await this.#targetFromRow(updated);
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async activateConnector(
    input: ActivateConnectorInput,
    version: VersionExpectation,
  ): Promise<SourceDefinition> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const currentResult = await client.query<SourceRow>(
        "SELECT * FROM source_definition WHERE source_id = $1 FOR UPDATE",
        [input.sourceId],
      );
      const currentRow = currentResult.rows[0];
      if (currentRow === undefined) {
        throw new RepositoryError("NOT_FOUND", `Source ${input.sourceId} was not found`);
      }
      const current = sourceFromRow(currentRow);
      if (current.version !== version.expectedVersion) {
        throw new RepositoryError(
          "VERSION_CONFLICT",
          `Source ${input.sourceId} is at version ${current.version}`,
        );
      }
      if (currentRow.source_group_id !== input.sourceGroupId) {
        throw new RepositoryError("INVALID_STATE", "Connector source group does not match source");
      }
      const approvalResult = await client.query<EffectiveApprovalRow>(
        `SELECT decision, projects, purposes, decided_at, expires_at
         FROM source_approval WHERE source_id = $1
         ORDER BY decided_at DESC, approval_id DESC LIMIT 1`,
        [input.sourceId],
      );
      const approval = approvalResult.rows[0];
      const occurredAt = Date.parse(input.occurredAt);
      if (
        approval === undefined ||
        (approval.decision !== "approved" && approval.decision !== "restricted") ||
        !approval.projects.includes(input.project) ||
        !approval.purposes.includes(input.purpose) ||
        Date.parse(timestamp(approval.decided_at)) > occurredAt ||
        Date.parse(timestamp(approval.expires_at)) <= occurredAt
      ) {
        throw new RepositoryError(
          "INVALID_STATE",
          "Connector activation requires an effective source approval for project and purpose",
        );
      }
      const configuration = {
        connector_id: input.connectorId,
        source_group_id: input.sourceGroupId,
        source_id: input.sourceId,
        endpoint: input.endpoint,
        method: input.method,
        request_body: input.requestBody,
        project: input.project,
        purpose: input.purpose,
        timeout_ms: input.timeoutMs,
        max_response_bytes: input.maxResponseBytes,
        max_compressed_response_bytes: input.maxCompressedResponseBytes,
        max_attempts: input.maxAttempts,
        pagination: input.pagination,
      };
      await client.query(
        `INSERT INTO connector_definition (
           connector_id, source_group_id, code_version, supported_source_ids,
           configuration_schema, enabled, created_at, updated_at, version
         ) VALUES ($1, $2, $3, $4, $5, true, $6, $6, 1)`,
        [
          input.connectorId,
          input.sourceGroupId,
          input.codeVersion,
          [input.sourceId],
          configuration,
          input.occurredAt,
        ],
      );
      await client.query(
        `INSERT INTO scheduler_job (
           job_id, job_type, target_id, due_at, cadence_seconds, active,
           created_at, updated_at
         ) VALUES ($1, 'connector', $2, $3, $4, true, $3, $3)`,
        [
          `JOB-CONN-${input.connectorId}`,
          input.connectorId,
          input.occurredAt,
          input.cadenceSeconds,
        ],
      );
      const updatedResult = await client.query<SourceRow>(
        `UPDATE source_definition
         SET version = version + 1, updated_at = $2
         WHERE source_id = $1 RETURNING *`,
        [input.sourceId, input.occurredAt],
      );
      const updated = sourceFromRow(updatedResult.rows[0]!);
      await client.query(
        `INSERT INTO audit_entry (
           audit_id, actor, action, target_type, target_id, reason, before_hash,
           after_hash, occurred_at, metadata
         ) VALUES ($1, $2, 'connector.activated', 'connector_definition', $3, $4, $5, $6, $7, $8)`,
        [
          `AUD-${input.connectorId}-1`,
          input.actor,
          input.connectorId,
          input.reason,
          digest(current),
          digest(updated),
          input.occurredAt,
          {
            sourceId: input.sourceId,
            sourceGroupId: input.sourceGroupId,
            codeVersion: input.codeVersion,
            project: input.project,
            purpose: input.purpose,
            fixtureEvidenceUrl: input.fixtureEvidenceUrl,
            liveProbeEvidenceUrl: input.liveProbeEvidenceUrl,
          },
        ],
      );
      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async acknowledgeIncident(
    input: IncidentActionInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    return this.#transitionIncident(input, version, "incident.acknowledged", async (client, current) => {
      if (current.status !== "open" && current.status !== "candidate") {
        throw new RepositoryError("INVALID_STATE", "Only an open incident can be acknowledged");
      }
      const result = await client.query<IncidentRow>(
        `UPDATE incident
         SET status = 'acknowledged', acknowledged_at = $2, acknowledged_by = $3,
             audit_version = audit_version + 1, updated_at = $2
         WHERE incident_id = $1 RETURNING *`,
        [input.incidentId, input.occurredAt, input.actor],
      );
      return incidentFromRow(result.rows[0]!);
    });
  }

  async suppressIncident(
    input: SuppressIncidentInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    return this.#transitionIncident(input, version, "incident.suppressed", async (client, current) => {
      if (current.status === "resolved") {
        throw new RepositoryError("INVALID_STATE", "A resolved incident cannot be suppressed");
      }
      if (input.expiresAt <= input.occurredAt) {
        throw new RepositoryError("INVALID_STATE", "Suppression expiry must be in the future");
      }
      const result = await client.query<IncidentRow>(
        `UPDATE incident
         SET status = 'suppressed', suppression_reason = $2, suppression_expires_at = $3,
             audit_version = audit_version + 1, updated_at = $4
         WHERE incident_id = $1 RETURNING *`,
        [input.incidentId, input.reason, input.expiresAt, input.occurredAt],
      );
      return incidentFromRow(result.rows[0]!);
    }, { expiresAt: input.expiresAt });
  }

  async resolveIncident(
    input: ResolveIncidentInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    return this.#transitionIncident(input, version, "incident.resolved", async (client, current) => {
      if (current.status === "resolved") {
        throw new RepositoryError("INVALID_STATE", "Incident is already resolved");
      }
      const observationIds = [...new Set(input.evidenceObservationIds)];
      if (observationIds.length < 2) {
        throw new RepositoryError("INVALID_STATE", "Resolution requires two healthy observations");
      }
      const placeholders = observationIds.map((_, index) => `$${index + 1}`).join(", ");
      const evidence = await client.query<ObservationRow>(
        `SELECT * FROM monitor_observation WHERE observation_id IN (${placeholders})`,
        observationIds,
      );
      if (
        evidence.rows.length !== observationIds.length ||
        evidence.rows.some(
          (observation) =>
            observation.outcome !== "pass" || !current.monitorIds.includes(observation.monitor_id),
        )
      ) {
        throw new RepositoryError(
          "INVALID_STATE",
          "Resolution evidence must be healthy observations for this incident",
        );
      }
      const result = await client.query<IncidentRow>(
        `UPDATE incident
         SET status = 'resolved', observation_ids = $2, resolved_at = $3, resolved_by = $4,
             cause = $5, audit_version = audit_version + 1, updated_at = $3
         WHERE incident_id = $1 RETURNING *`,
        [
          input.incidentId,
          [...new Set([...current.observationIds, ...observationIds])],
          input.occurredAt,
          input.actor,
          input.cause,
        ],
      );
      return incidentFromRow(result.rows[0]!);
    }, { cause: input.cause, evidenceObservationIds: input.evidenceObservationIds });
  }

  async publishIncident(
    input: PublishIncidentInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    return this.#transitionIncident(input, version, "incident.published", async (client, current) => {
      if (current.status === "candidate") {
        throw new RepositoryError("INVALID_STATE", "A candidate incident cannot be published");
      }
      if (
        input.publicSummary.en === null ||
        input.publicSummary.zhHant === null ||
        input.publicSummary.en.trim() === "" ||
        input.publicSummary.zhHant.trim() === ""
      ) {
        throw new RepositoryError("INVALID_STATE", "Publication requires reviewed bilingual wording");
      }
      const result = await client.query<IncidentRow>(
        `UPDATE incident
         SET public_state = 'published', public_summary = $2,
             audit_version = audit_version + 1, updated_at = $3
         WHERE incident_id = $1 RETURNING *`,
        [
          input.incidentId,
          { en: input.publicSummary.en, zh_Hant: input.publicSummary.zhHant },
          input.occurredAt,
        ],
      );
      return incidentFromRow(result.rows[0]!);
    }, { publicSummary: { en: input.publicSummary.en, zhHant: input.publicSummary.zhHant } });
  }

  async correctIncident(
    input: CorrectIncidentInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    return this.#transitionIncident(input, version, "incident.corrected", async (client, current) => {
      if (current.publicState !== "published" && current.publicState !== "corrected") {
        throw new RepositoryError("INVALID_STATE", "Only published wording can be corrected");
      }
      if (
        input.publicSummary.en === null ||
        input.publicSummary.zhHant === null ||
        input.publicSummary.en.trim() === "" ||
        input.publicSummary.zhHant.trim() === ""
      ) {
        throw new RepositoryError("INVALID_STATE", "Correction requires reviewed bilingual wording");
      }
      const result = await client.query<IncidentRow>(
        `UPDATE incident
         SET public_state = 'corrected', public_summary = $2, correction_reference = $3,
             audit_version = audit_version + 1, updated_at = $4
         WHERE incident_id = $1 RETURNING *`,
        [
          input.incidentId,
          { en: input.publicSummary.en, zh_Hant: input.publicSummary.zhHant },
          input.correctionReference,
          input.occurredAt,
        ],
      );
      return incidentFromRow(result.rows[0]!);
    }, (current) => ({
      priorPublicSummary:
        current.publicSummary === undefined || current.publicSummary === null
          ? null
          : { en: current.publicSummary.en, zhHant: current.publicSummary.zhHant },
      correctionReference: input.correctionReference,
    }));
  }

  async #transitionIncident(
    input: IncidentActionInput,
    version: VersionExpectation,
    action: AuditEntry["action"],
    update: (client: PostgresClient, current: Incident) => Promise<Incident>,
    metadata:
      | AuditEntry["metadata"]
      | ((current: Incident) => AuditEntry["metadata"]) = {},
  ): Promise<Incident> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await client.query<IncidentRow>(
        "SELECT * FROM incident WHERE incident_id = $1 FOR UPDATE",
        [input.incidentId],
      );
      const row = result.rows[0];
      if (row === undefined) {
        throw new RepositoryError("NOT_FOUND", `Incident ${input.incidentId} was not found`);
      }
      const current = incidentFromRow(row);
      if (current.auditVersion !== version.expectedVersion) {
        throw new RepositoryError(
          "VERSION_CONFLICT",
          `Incident ${input.incidentId} is at version ${current.auditVersion}`,
        );
      }
      const updated = await update(client, current);
      await client.query(
        `INSERT INTO audit_entry (
           audit_id, actor, action, target_type, target_id, reason, before_hash,
           after_hash, occurred_at, metadata
         ) VALUES ($1, $2, $3, 'incident', $4, $5, $6, $7, $8, $9)`,
        [
          `AUD-${input.incidentId}-${updated.auditVersion}`,
          input.actor,
          action,
          input.incidentId,
          input.reason,
          digest(current),
          digest(updated),
          input.occurredAt,
          typeof metadata === "function" ? metadata(current) : metadata,
        ],
      );
      await client.query("COMMIT");
      return updated;
    } catch (error) {
      await rollback(client);
      throw error;
    } finally {
      client.release();
    }
  }

  async listAudit(input: ListAuditInput): Promise<Page<AuditEntry>> {
    if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 200) {
      throw new RangeError("limit must be an integer from 1 to 200");
    }
    const after = cursorAfter(input.cursor);
    const result = await this.#pool.query<AuditRow>(
      `SELECT * FROM audit_entry
       WHERE ($1::text IS NULL OR target_id = $1)
         AND ($2::text IS NULL OR audit_id > $2)
       ORDER BY audit_id
       LIMIT $3`,
      [input.targetId ?? null, after, input.limit + 1],
    );
    return cursorPage(result.rows.map(auditFromRow), input.limit, (entry) => entry.auditId);
  }
}

export function createPostgresRepository(pool: PostgresPool): PlatformRepository {
  return new PostgresPlatformRepository(pool);
}
