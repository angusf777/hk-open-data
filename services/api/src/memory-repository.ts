import { createHash } from "node:crypto";

import type {
  AuditEntry,
  CanonicalEvent,
  Incident,
  MonitorObservation,
  MonitorTarget,
  MonitorTargetDetail,
  SourceApprovalDecision,
  SourceDefinition,
  SourceRecord,
  StatusSummary,
  Visibility,
} from "./domain.js";
import type {
  ActivateConnectorInput,
  ListAuditInput,
  ListEventsInput,
  ListIncidentsInput,
  ListMonitorTargetsInput,
  ListSourcesInput,
  ListSourceRecordsInput,
  Page,
  PlatformRepository,
  ActivateMonitorInput,
  IncidentActionInput,
  PublishIncidentInput,
  CorrectIncidentInput,
  ResolveIncidentInput,
  SuppressIncidentInput,
  VersionExpectation,
  OperationalMetrics,
} from "./repository.js";
import { RepositoryError } from "./repository.js";

interface MemoryRepositorySeed {
  sources?: SourceDefinition[];
  sourceRecords?: SourceRecord[];
  events?: CanonicalEvent[];
  monitorTargets?: MonitorTarget[];
  observations?: MonitorObservation[];
  incidents?: Incident[];
  audit?: AuditEntry[];
}

interface CursorPayload {
  after: string;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function encodeCursor(after: string): string {
  return Buffer.from(JSON.stringify({ after } satisfies CursorPayload), "utf8").toString(
    "base64url",
  );
}

function decodeCursor(cursor: string | undefined): string | null {
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

function page<T>(
  items: T[],
  limit: number,
  cursor: string | undefined,
  key: (item: T) => string,
): Page<T> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new RangeError("limit must be an integer from 1 to 200");
  }
  const after = decodeCursor(cursor);
  const eligible = after === null ? items : items.filter((item) => key(item) > after);
  const selected = eligible.slice(0, limit);
  const last = selected.at(-1);
  return {
    items: clone(selected),
    nextCursor: selected.length < eligible.length && last !== undefined ? encodeCursor(key(last)) : null,
  };
}

export class MemoryPlatformRepository implements PlatformRepository {
  readonly #sources: Map<string, SourceDefinition>;
  readonly #sourceRecords: Map<string, SourceRecord>;
  readonly #events: Map<string, CanonicalEvent>;
  readonly #monitorTargets: Map<string, MonitorTarget>;
  readonly #observations: MonitorObservation[];
  readonly #incidents: Map<string, Incident>;
  readonly #audit: AuditEntry[];
  readonly #sourceApprovals: Map<string, SourceApprovalDecision>;

  constructor(seed: MemoryRepositorySeed = {}) {
    this.#sources = new Map(
      (seed.sources ?? []).map((source) => [source.sourceId, clone(source)]),
    );
    this.#sourceRecords = new Map(
      (seed.sourceRecords ?? []).map((record) => [record.sourceRecordId, clone(record)]),
    );
    this.#events = new Map((seed.events ?? []).map((event) => [event.eventId, clone(event)]));
    this.#monitorTargets = new Map(
      (seed.monitorTargets ?? []).map((target) => [target.monitorId, clone(target)]),
    );
    this.#observations = clone(seed.observations ?? []);
    this.#incidents = new Map(
      (seed.incidents ?? []).map((incident) => [incident.incidentId, clone(incident)]),
    );
    this.#audit = clone(seed.audit ?? []);
    this.#sourceApprovals = new Map();
  }

  async healthCheck(): Promise<void> {
    return undefined;
  }

  async metricsSnapshot(now: string): Promise<OperationalMetrics> {
    const delayedChecks = [...this.#monitorTargets.values()].filter((target) => {
      if (target.activationStatus !== "approved") return false;
      if (target.lastCheckedAt === null) return true;
      return Date.parse(now) - Date.parse(target.lastCheckedAt) > 5 * 60 * 1_000;
    }).length;
    return {
      schedulerBacklog: 0,
      delayedChecks,
      staleConnectors: [...this.#sources.values()].filter(
        (source) => source.freshnessStatus === "stale",
      ).length,
      failedWebhooks: 0,
    };
  }

  async listSources(input: ListSourcesInput): Promise<Page<SourceDefinition>> {
    const sources = [...this.#sources.values()]
      .filter((source) => {
        if (
          input.visibility === "public" &&
          (source.visibility !== "public" || source.approvalStatus !== "approved")
        ) {
          return false;
        }
        if (input.project !== undefined && !source.projects.includes(input.project)) {
          return false;
        }
        if (
          input.authorityClass !== undefined &&
          source.authorityClass !== input.authorityClass
        ) {
          return false;
        }
        if (
          input.freshnessStatus !== undefined &&
          source.freshnessStatus !== input.freshnessStatus
        ) {
          return false;
        }
        return input.approvalStatus === undefined || source.approvalStatus === input.approvalStatus;
      })
      .sort((left, right) => left.sourceId.localeCompare(right.sourceId));

    return page(sources, input.limit, input.cursor, (source) => source.sourceId);
  }

  async getSource(sourceId: string, visibility: Visibility): Promise<SourceDefinition | null> {
    const source = this.#sources.get(sourceId);
    if (
      source === undefined ||
      (visibility === "public" &&
        (source.visibility !== "public" || source.approvalStatus !== "approved"))
    ) {
      return null;
    }
    return clone(source);
  }

  async listSourceRecords(input: ListSourceRecordsInput): Promise<Page<SourceRecord>> {
    const records = [...this.#sourceRecords.values()]
      .filter((record) => {
        const observed = record.observedAt ?? record.retrievedAt;
        return (
          (input.sourceId === undefined || record.sourceId === input.sourceId) &&
          (input.observedFrom === undefined || observed >= input.observedFrom) &&
          (input.observedTo === undefined || observed <= input.observedTo) &&
          (input.publishedFrom === undefined ||
            (record.publishedAt !== null &&
              record.publishedAt !== undefined &&
              record.publishedAt >= input.publishedFrom)) &&
          (input.publishedTo === undefined ||
            (record.publishedAt !== null &&
              record.publishedAt !== undefined &&
              record.publishedAt <= input.publishedTo)) &&
          (input.language === undefined || record.language === input.language)
        );
      })
      .sort((left, right) => left.sourceRecordId.localeCompare(right.sourceRecordId));
    return page(records, input.limit, input.cursor, (record) => record.sourceRecordId);
  }

  async getSourceRecord(sourceRecordId: string): Promise<SourceRecord | null> {
    const record = this.#sourceRecords.get(sourceRecordId);
    return record === undefined ? null : clone(record);
  }

  async listEvents(input: ListEventsInput): Promise<Page<CanonicalEvent>> {
    const events = [...this.#events.values()]
      .filter(
        (event) =>
          (input.eventType === undefined || event.eventType === input.eventType) &&
          (input.status === undefined || event.status === input.status) &&
          (input.severity === undefined || event.severity === input.severity) &&
          (input.observedFrom === undefined || event.observedAt >= input.observedFrom) &&
          (input.observedTo === undefined || event.observedAt <= input.observedTo) &&
          (input.affectedEntity === undefined ||
            event.affectedEntities?.includes(input.affectedEntity) === true),
      )
      .sort((left, right) => left.eventId.localeCompare(right.eventId));
    return page(events, input.limit, input.cursor, (event) => event.eventId);
  }

  async getEvent(eventId: string): Promise<CanonicalEvent | null> {
    const event = this.#events.get(eventId);
    return event === undefined ? null : clone(event);
  }

  async listMonitorTargets(input: ListMonitorTargetsInput): Promise<Page<MonitorTarget>> {
    const targets = [...this.#monitorTargets.values()]
      .filter(
        (target) =>
          (input.visibility === "private" || target.publicVisibility === "public") &&
          (input.provider === undefined || target.provider === input.provider) &&
          (input.sourceId === undefined || target.sourceId === input.sourceId) &&
          (input.outcome === undefined || target.outcome === input.outcome),
      )
      .sort((left, right) => left.monitorId.localeCompare(right.monitorId));
    return page(targets, input.limit, input.cursor, (target) => target.monitorId);
  }

  async getMonitorTarget(
    monitorId: string,
    visibility: Visibility,
    historyLimit: number,
  ): Promise<MonitorTargetDetail | null> {
    const target = this.#monitorTargets.get(monitorId);
    if (
      target === undefined ||
      (visibility === "public" && target.publicVisibility !== "public")
    ) {
      return null;
    }
    return {
      target: clone(target),
      observations: clone(
        this.#observations
          .filter((observation) => observation.monitorId === monitorId)
          .sort((left, right) => right.startedAt.localeCompare(left.startedAt))
          .slice(0, historyLimit),
      ),
      incidents: clone(
        [...this.#incidents.values()].filter(
          (incident) =>
            incident.monitorIds.includes(monitorId) &&
            (visibility === "private" ||
              incident.publicState === "published" ||
              incident.publicState === "corrected"),
        ),
      ),
    };
  }

  async listIncidents(input: ListIncidentsInput): Promise<Page<Incident>> {
    const incidents = [...this.#incidents.values()]
      .filter(
        (incident) =>
          (input.visibility === "private" ||
            incident.publicState === "published" ||
            incident.publicState === "corrected") &&
          (input.status === undefined || incident.status === input.status) &&
          (input.severity === undefined || incident.severity === input.severity) &&
          (input.sourceId === undefined || incident.sourceId === input.sourceId) &&
          (input.openedFrom === undefined || incident.openedAt >= input.openedFrom) &&
          (input.openedTo === undefined || incident.openedAt <= input.openedTo),
      )
      .sort((left, right) => left.incidentId.localeCompare(right.incidentId));
    return page(incidents, input.limit, input.cursor, (incident) => incident.incidentId);
  }

  async getIncident(incidentId: string, visibility: Visibility): Promise<Incident | null> {
    const incident = this.#incidents.get(incidentId);
    if (
      incident === undefined ||
      (visibility === "public" &&
        incident.publicState !== "published" &&
        incident.publicState !== "corrected")
    ) {
      return null;
    }
    return clone(incident);
  }

  async getStatusSummary(
    generatedAt: string,
    input: import("./repository.js").StatusSummaryInput = {},
  ): Promise<StatusSummary> {
    const targets = [...this.#monitorTargets.values()].filter(
      (target) => {
        const source = this.#sources.get(target.sourceId);
        return (
          target.publicVisibility === "public" &&
          (input.provider === undefined || target.provider === input.provider) &&
          (input.project === undefined || source?.projects.includes(input.project) === true)
        );
      },
    );
    const counts: Record<string, number> = {};
    for (const target of targets) {
      counts[target.outcome] = (counts[target.outcome] ?? 0) + 1;
    }
    const currentIncidents = [...this.#incidents.values()].filter(
      (incident) =>
        incident.status !== "resolved" &&
        (incident.publicState === "published" || incident.publicState === "corrected") &&
        targets.some((target) => target.sourceId === incident.sourceId),
    );
    const overall = currentIncidents.some(
      (incident) => incident.severity === "critical" || incident.severity === "major",
    )
      ? "major_outage"
      : currentIncidents.length > 0 || targets.some((target) => target.outcome === "degraded" || target.outcome === "fail")
        ? "degraded"
        : targets.length === 0
          ? "unknown"
          : "operational";
    return {
      generatedAt,
      overall,
      counts,
      currentIncidents: clone(currentIncidents),
    };
  }

  async decideSourceApproval(
    decision: SourceApprovalDecision,
    version: VersionExpectation,
  ): Promise<SourceDefinition> {
    const current = this.#sources.get(decision.sourceId);
    if (current === undefined) {
      throw new RepositoryError("NOT_FOUND", `Source ${decision.sourceId} was not found`);
    }
    if (current.version !== version.expectedVersion) {
      throw new RepositoryError(
        "VERSION_CONFLICT",
        `Source ${decision.sourceId} is at version ${current.version}`,
      );
    }

    const updated: SourceDefinition = {
      ...current,
      approvalStatus: decision.decision,
      approvedUses:
        decision.decision === "approved" || decision.decision === "restricted"
          ? decision.purposes
          : [],
      version: current.version + 1,
      updatedAt: decision.decidedAt,
    };
    const entry: AuditEntry = {
      auditId: `AUD-${String(this.#audit.length + 1).padStart(6, "0")}`,
      actor: decision.actor,
      action: "source.approval_decided",
      targetType: "source_definition",
      targetId: decision.sourceId,
      reason: decision.reason,
      beforeHash: hash(current),
      afterHash: hash(updated),
      occurredAt: decision.decidedAt,
      metadata: {
        evidenceUrls: decision.evidenceUrls,
        purposes: decision.purposes,
        projects: decision.projects,
        expiresAt: decision.expiresAt,
      },
    };

    this.#sources.set(updated.sourceId, updated);
    this.#sourceApprovals.set(updated.sourceId, clone(decision));
    this.#audit.push(entry);
    return clone(updated);
  }

  async activateMonitorTarget(
    input: ActivateMonitorInput,
    version: VersionExpectation,
  ): Promise<MonitorTarget> {
    const current = this.#monitorTargets.get(input.monitorId);
    if (current === undefined) {
      throw new RepositoryError("NOT_FOUND", `Monitor ${input.monitorId} was not found`);
    }
    const currentVersion = current.version ?? 1;
    if (currentVersion !== version.expectedVersion) {
      throw new RepositoryError(
        "VERSION_CONFLICT",
        `Monitor ${input.monitorId} is at version ${currentVersion}`,
      );
    }
    const approval = this.#sourceApprovals.get(current.sourceId);
    if (
      approval === undefined ||
      !["approved", "restricted"].includes(approval.decision) ||
      !approval.projects.includes("P14") ||
      !approval.purposes.includes("quality-monitoring") ||
      approval.decidedAt > input.occurredAt ||
      approval.expiresAt <= input.occurredAt
    ) {
      throw new RepositoryError(
        "INVALID_STATE",
        "Monitor activation requires an effective P14 quality-monitoring approval",
      );
    }
    if (input.evidenceObservationIds.length === 0) {
      throw new RepositoryError(
        "INVALID_STATE",
        "Monitor baseline requires observation evidence",
      );
    }
    const updated: MonitorTarget = {
      ...current,
      publicVisibility: input.publicVisibility,
      baselineVersion: (current.baselineVersion ?? 0) + 1,
      activationStatus: "approved",
      operatorIdentity: input.operatorIdentity,
      ruleVersion: input.ruleVersion,
      version: currentVersion + 1,
    };
    this.#monitorTargets.set(input.monitorId, updated);
    this.#audit.push({
      auditId: `AUD-${String(this.#audit.length + 1).padStart(6, "0")}`,
      actor: input.actor,
      action: "monitor.activated",
      targetType: "monitor_target",
      targetId: input.monitorId,
      reason: input.reason,
      beforeHash: hash(current),
      afterHash: hash(updated),
      occurredAt: input.occurredAt,
      metadata: {
        operatorIdentity: input.operatorIdentity,
        ruleVersion: input.ruleVersion,
        evidenceObservationIds: input.evidenceObservationIds,
      },
    });
    return clone(updated);
  }

  async activateConnector(
    input: ActivateConnectorInput,
    version: VersionExpectation,
  ): Promise<SourceDefinition> {
    const current = this.#sources.get(input.sourceId);
    if (current === undefined) {
      throw new RepositoryError("NOT_FOUND", `Source ${input.sourceId} was not found`);
    }
    if (current.version !== version.expectedVersion) {
      throw new RepositoryError(
        "VERSION_CONFLICT",
        `Source ${input.sourceId} is at version ${current.version}`,
      );
    }
    const approval = this.#sourceApprovals.get(input.sourceId);
    if (
      approval === undefined ||
      !["approved", "restricted"].includes(approval.decision) ||
      !approval.projects.includes(input.project) ||
      !approval.purposes.includes(input.purpose) ||
      approval.decidedAt > input.occurredAt ||
      approval.expiresAt <= input.occurredAt
    ) {
      throw new RepositoryError(
        "INVALID_STATE",
        "Connector activation requires an effective source approval for project and purpose",
      );
    }
    if (
      current.sourceGroupId !== undefined &&
      current.sourceGroupId !== null &&
      current.sourceGroupId !== input.sourceGroupId
    ) {
      throw new RepositoryError("INVALID_STATE", "Connector source group does not match source");
    }
    const updated = {
      ...current,
      sourceGroupId: input.sourceGroupId,
      version: current.version + 1,
      updatedAt: input.occurredAt,
    };
    this.#sources.set(input.sourceId, updated);
    this.#audit.push({
      auditId: `AUD-${String(this.#audit.length + 1).padStart(6, "0")}`,
      actor: input.actor,
      action: "connector.activated",
      targetType: "connector_definition",
      targetId: input.connectorId,
      reason: input.reason,
      beforeHash: hash(current),
      afterHash: hash(updated),
      occurredAt: input.occurredAt,
      metadata: {
        sourceId: input.sourceId,
        sourceGroupId: input.sourceGroupId,
        codeVersion: input.codeVersion,
        project: input.project,
        purpose: input.purpose,
        fixtureEvidenceUrl: input.fixtureEvidenceUrl,
        liveProbeEvidenceUrl: input.liveProbeEvidenceUrl,
      },
    });
    return clone(updated);
  }

  async acknowledgeIncident(
    input: IncidentActionInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    return this.#transitionIncident(input, version, "incident.acknowledged", (current) => {
      if (current.status !== "open" && current.status !== "candidate") {
        throw new RepositoryError("INVALID_STATE", "Only an open incident can be acknowledged");
      }
      return {
        ...current,
        status: "acknowledged",
        acknowledgedAt: input.occurredAt,
        acknowledgedBy: input.actor,
        auditVersion: current.auditVersion + 1,
      };
    });
  }

  async suppressIncident(
    input: SuppressIncidentInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    return this.#transitionIncident(input, version, "incident.suppressed", (current) => {
      if (current.status === "resolved") {
        throw new RepositoryError("INVALID_STATE", "A resolved incident cannot be suppressed");
      }
      if (input.expiresAt <= input.occurredAt) {
        throw new RepositoryError("INVALID_STATE", "Suppression expiry must be in the future");
      }
      return {
        ...current,
        status: "suppressed",
        suppressionReason: input.reason,
        suppressionExpiresAt: input.expiresAt,
        auditVersion: current.auditVersion + 1,
      };
    }, { expiresAt: input.expiresAt });
  }

  async resolveIncident(
    input: ResolveIncidentInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    return this.#transitionIncident(input, version, "incident.resolved", (current) => {
      if (current.status === "resolved") {
        throw new RepositoryError("INVALID_STATE", "Incident is already resolved");
      }
      if (new Set(input.evidenceObservationIds).size < 2) {
        throw new RepositoryError("INVALID_STATE", "Resolution requires two healthy observations");
      }
      const evidence = input.evidenceObservationIds.map((observationId) =>
        this.#observations.find((observation) => observation.observationId === observationId),
      );
      if (
        evidence.some(
          (observation) =>
            observation === undefined ||
            observation.outcome !== "pass" ||
            !current.monitorIds.includes(observation.monitorId),
        )
      ) {
        throw new RepositoryError(
          "INVALID_STATE",
          "Resolution evidence must be healthy observations for this incident",
        );
      }
      return {
        ...current,
        status: "resolved",
        observationIds: [...new Set([...current.observationIds, ...input.evidenceObservationIds])],
        resolvedAt: input.occurredAt,
        resolvedBy: input.actor,
        cause: input.cause,
        auditVersion: current.auditVersion + 1,
      };
    }, { cause: input.cause, evidenceObservationIds: input.evidenceObservationIds });
  }

  async publishIncident(
    input: PublishIncidentInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    return this.#transitionIncident(input, version, "incident.published", (current) => {
      if (current.status === "candidate") {
        throw new RepositoryError("INVALID_STATE", "A candidate incident cannot be published");
      }
      if (
        input.publicSummary.en?.trim() === "" ||
        input.publicSummary.zhHant?.trim() === "" ||
        input.publicSummary.en === null ||
        input.publicSummary.zhHant === null
      ) {
        throw new RepositoryError("INVALID_STATE", "Publication requires reviewed bilingual wording");
      }
      return {
        ...current,
        publicState: "published",
        publicSummary: input.publicSummary,
        auditVersion: current.auditVersion + 1,
      };
    }, { publicSummary: { en: input.publicSummary.en, zhHant: input.publicSummary.zhHant } });
  }

  async correctIncident(
    input: CorrectIncidentInput,
    version: VersionExpectation,
  ): Promise<Incident> {
    const prior = this.#incidents.get(input.incidentId)?.publicSummary;
    return this.#transitionIncident(input, version, "incident.corrected", (current) => {
      if (current.publicState !== "published" && current.publicState !== "corrected") {
        throw new RepositoryError("INVALID_STATE", "Only published wording can be corrected");
      }
      if (
        input.publicSummary.en?.trim() === "" ||
        input.publicSummary.zhHant?.trim() === "" ||
        input.publicSummary.en === null ||
        input.publicSummary.zhHant === null
      ) {
        throw new RepositoryError("INVALID_STATE", "Correction requires reviewed bilingual wording");
      }
      return {
        ...current,
        publicState: "corrected",
        publicSummary: input.publicSummary,
        correctionReference: input.correctionReference,
        auditVersion: current.auditVersion + 1,
      };
    }, {
      priorPublicSummary:
        prior === undefined || prior === null
          ? null
          : { en: prior.en, zhHant: prior.zhHant },
      correctionReference: input.correctionReference,
    });
  }

  #transitionIncident(
    input: IncidentActionInput,
    version: VersionExpectation,
    action: AuditEntry["action"],
    update: (current: Incident) => Incident,
    metadata: { [key: string]: import("./domain.js").JsonValue } = {},
  ): Incident {
    const current = this.#incidents.get(input.incidentId);
    if (current === undefined) {
      throw new RepositoryError("NOT_FOUND", `Incident ${input.incidentId} was not found`);
    }
    if (current.auditVersion !== version.expectedVersion) {
      throw new RepositoryError(
        "VERSION_CONFLICT",
        `Incident ${input.incidentId} is at version ${current.auditVersion}`,
      );
    }
    const updated = update(current);
    this.#incidents.set(updated.incidentId, updated);
    this.#audit.push({
      auditId: `AUD-${String(this.#audit.length + 1).padStart(6, "0")}`,
      actor: input.actor,
      action,
      targetType: "incident",
      targetId: input.incidentId,
      reason: input.reason,
      beforeHash: hash(current),
      afterHash: hash(updated),
      occurredAt: input.occurredAt,
      metadata,
    });
    return clone(updated);
  }

  async listAudit(input: ListAuditInput): Promise<Page<AuditEntry>> {
    const entries = this.#audit
      .filter((entry) => input.targetId === undefined || entry.targetId === input.targetId)
      .sort((left, right) => left.auditId.localeCompare(right.auditId));
    return page(entries, input.limit, input.cursor, (entry) => entry.auditId);
  }
}
