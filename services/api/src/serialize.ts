import type { OperatingProfile } from "@hk-open-data/schemas";

import type {
  CanonicalEvent,
  Incident,
  LocalizedText,
  MonitorObservation,
  MonitorTarget,
  SourceDefinition,
  SourceRecord,
  StatusSummary,
} from "./domain.js";

function localized(value: LocalizedText): Record<string, string | null> {
  return {
    en: value.en,
    zh_Hant: value.zhHant,
    ...(value.zhHans === undefined ? {} : { zh_Hans: value.zhHans }),
  };
}

export function sourceResponse(
  source: SourceDefinition,
  operatingProfile: OperatingProfile,
): Record<string, unknown> {
  return {
    source_id: source.sourceId,
    operating_profile: operatingProfile,
    ...(source.catalogueId === undefined ? {} : { catalogue_id: source.catalogueId }),
    ...(source.catalogueVerifiedAt === undefined
      ? {}
      : { catalogue_verified_at: source.catalogueVerifiedAt }),
    ...(source.termsEvidenceState === undefined
      ? {}
      : { terms_evidence_state: source.termsEvidenceState }),
    ...(source.sourceGroupId === undefined ? {} : { source_group_id: source.sourceGroupId }),
    name: source.name,
    provider: source.provider,
    authority_class: source.authorityClass,
    approval_status: source.approvalStatus,
    freshness_status: source.freshnessStatus,
    last_success_at: source.lastSuccessAt,
    limitations: source.limitations,
    documentation_url: source.documentationUrl,
    cadence: source.cadence,
    approved_uses: source.approvedUses,
    version: source.version,
  };
}

export function sourceRecordResponse(
  record: SourceRecord,
  operatingProfile: OperatingProfile,
): Record<string, unknown> {
  return {
    source_record_id: record.sourceRecordId,
    source_id: record.sourceId,
    operating_profile: operatingProfile,
    ...(record.catalogueId === undefined ? {} : { catalogue_id: record.catalogueId }),
    ...(record.termsEvidenceState === undefined
      ? {}
      : { terms_evidence_state: record.termsEvidenceState }),
    ...(record.evidenceMode === undefined ? {} : { evidence_mode: record.evidenceMode }),
    source_group_id: record.sourceGroupId,
    provider: record.provider,
    authority_class: record.authorityClass,
    retrieved_at: record.retrievedAt,
    content_type: record.contentType,
    raw_payload_hash: record.rawPayloadHash,
    raw_storage_uri: record.rawStorageUri,
    approval_reference: record.approvalReference,
    schema_version: record.schemaVersion,
    freshness_status: record.freshnessStatus,
    quality_flags: record.qualityFlags,
    parent_record_ids: record.parentRecordIds,
    ...(record.recordKey === undefined ? {} : { record_key: record.recordKey }),
    ...(record.sourceName === undefined ? {} : { source_name: record.sourceName }),
    ...(record.sourceUrl === undefined ? {} : { source_url: record.sourceUrl }),
    ...(record.documentationUrl === undefined
      ? {}
      : { documentation_url: record.documentationUrl }),
    ...(record.observedAt === undefined ? {} : { observed_at: record.observedAt }),
    ...(record.publishedAt === undefined ? {} : { published_at: record.publishedAt }),
    ...(record.effectiveAt === undefined ? {} : { effective_at: record.effectiveAt }),
    ...(record.expiresAt === undefined ? {} : { expires_at: record.expiresAt }),
    ...(record.language === undefined ? {} : { language: record.language }),
    ...(record.rightsReference === undefined
      ? {}
      : { rights_reference: record.rightsReference }),
    ...(record.attribution === undefined ? {} : { attribution: record.attribution }),
    ...(record.schemaFingerprint === undefined
      ? {}
      : { schema_fingerprint: record.schemaFingerprint }),
    ...(record.transformVersion === undefined
      ? {}
      : { transform_version: record.transformVersion }),
  };
}

export function eventResponse(event: CanonicalEvent): Record<string, unknown> {
  return {
    event_id: event.eventId,
    event_type: event.eventType,
    status: event.status,
    severity: event.severity,
    title: localized(event.title),
    summary: localized(event.summary),
    source_records: event.sourceRecords,
    observed_at: event.observedAt,
    quality_flags: event.qualityFlags,
    schema_version: event.schemaVersion,
    ...(event.affectedEntities === undefined
      ? {}
      : { affected_entities: event.affectedEntities }),
    ...(event.startedAt === undefined ? {} : { started_at: event.startedAt }),
    ...(event.expectedEndAt === undefined
      ? {}
      : { expected_end_at: event.expectedEndAt }),
    ...(event.expiresAt === undefined ? {} : { expires_at: event.expiresAt }),
  };
}

export function targetResponse(target: MonitorTarget): Record<string, unknown> {
  return {
    monitor_id: target.monitorId,
    source_id: target.sourceId,
    provider: target.provider,
    name: target.name,
    outcome: target.outcome,
    last_checked_at: target.lastCheckedAt,
    public_visibility: target.publicVisibility,
    baseline_version: target.baselineVersion,
    ...(target.activationStatus === undefined
      ? {}
      : { activation_status: target.activationStatus }),
    ...(target.operatorIdentity === undefined
      ? {}
      : { operator_identity: target.operatorIdentity }),
    ...(target.ruleVersion === undefined ? {} : { rule_version: target.ruleVersion }),
    ...(target.version === undefined ? {} : { version: target.version }),
  };
}

export function observationResponse(observation: MonitorObservation): Record<string, unknown> {
  return {
    observation_id: observation.observationId,
    monitor_id: observation.monitorId,
    started_at: observation.startedAt,
    finished_at: observation.finishedAt,
    outcome: observation.outcome,
    check_results: observation.checkResults,
    latency_ms: observation.latencyMs,
    evidence_hash: observation.evidenceHash,
    baseline_version: observation.baselineVersion,
    seeded_failure: observation.seededFailure,
    ...(observation.httpStatus === undefined ? {} : { http_status: observation.httpStatus }),
    ...(observation.providerTimestamp === undefined
      ? {}
      : { provider_timestamp: observation.providerTimestamp }),
    ...(observation.freshnessAgeSeconds === undefined
      ? {}
      : { freshness_age_seconds: observation.freshnessAgeSeconds }),
    ...(observation.contentHash === undefined
      ? {}
      : { content_hash: observation.contentHash }),
    ...(observation.schemaFingerprint === undefined
      ? {}
      : { schema_fingerprint: observation.schemaFingerprint }),
    ...(observation.connectorRunId === undefined
      ? {}
      : { connector_run_id: observation.connectorRunId }),
    ...(observation.correlationId === undefined
      ? {}
      : { correlation_id: observation.correlationId }),
  };
}

export function incidentResponse(incident: Incident): Record<string, unknown> {
  return {
    incident_id: incident.incidentId,
    source_id: incident.sourceId,
    status: incident.status,
    severity: incident.severity,
    category: incident.category,
    monitor_ids: incident.monitorIds,
    observation_ids: incident.observationIds,
    opened_at: incident.openedAt,
    last_observed_at: incident.lastObservedAt,
    public_state: incident.publicState,
    audit_version: incident.auditVersion,
    ...(incident.acknowledgedAt === undefined
      ? {}
      : { acknowledged_at: incident.acknowledgedAt }),
    ...(incident.acknowledgedBy === undefined
      ? {}
      : { acknowledged_by: incident.acknowledgedBy }),
    ...(incident.resolvedAt === undefined ? {} : { resolved_at: incident.resolvedAt }),
    ...(incident.resolvedBy === undefined ? {} : { resolved_by: incident.resolvedBy }),
    ...(incident.suppressionReason === undefined
      ? {}
      : { suppression_reason: incident.suppressionReason }),
    ...(incident.suppressionExpiresAt === undefined
      ? {}
      : { suppression_expires_at: incident.suppressionExpiresAt }),
    ...(incident.internalSummary === undefined
      ? {}
      : { internal_summary: incident.internalSummary }),
    ...(incident.publicSummary === undefined
      ? {}
      : {
          public_summary:
            incident.publicSummary === null ? null : localized(incident.publicSummary),
        }),
    ...(incident.cause === undefined ? {} : { cause: incident.cause }),
    ...(incident.correctionReference === undefined
      ? {}
      : { correction_reference: incident.correctionReference }),
  };
}

export function statusResponse(
  summary: StatusSummary,
  operatingProfile: OperatingProfile,
): Record<string, unknown> {
  return {
    operating_profile: operatingProfile,
    generated_at: summary.generatedAt,
    overall: summary.overall,
    counts: summary.counts,
    current_incidents: summary.currentIncidents.map(incidentResponse),
  };
}
