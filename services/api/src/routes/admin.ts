import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { requireMfa, type RequestPrincipal } from "../auth.js";
import { HttpError } from "../errors.js";
import { incidentResponse, sourceResponse, targetResponse } from "../serialize.js";
import type { RouteContext } from "./context.js";
import { identifier, pageQuery, pageResponse } from "./query.js";

const approvalInput = z.object({
  decision: z.enum(["approved", "restricted", "rejected", "revoked"]),
  projects: z.array(z.string().regex(/^P[0-9]{2}$/)).min(1),
  purposes: z.array(z.string().min(1)).min(1),
  storage: z.string().min(1),
  retention: z.string().min(1),
  redistribution: z.string().min(1),
  attribution: z.string().min(1),
  evidence: z.array(z.url()).min(1),
  expires_at: z.iso.datetime(),
  reason: z.string().min(1),
});

const reasonInput = z.object({ reason: z.string().trim().min(1) });
const suppressionInput = reasonInput.extend({ expires_at: z.iso.datetime() });
const resolutionInput = reasonInput.extend({
  cause: z.string().trim().min(1),
  evidence_observation_ids: z.array(identifier).min(2),
});
const publicationInput = reasonInput.extend({
  public_summary: z.object({
    en: z.string().trim().min(1),
    zh_Hant: z.string().trim().min(1),
  }),
});
const correctionInput = publicationInput.extend({
  correction_reference: z.string().trim().min(1),
});
const monitorActivationInput = z.object({
  reason: z.string().trim().min(1),
  operator_identity: z.string().trim().min(1),
  rule_version: z.string().trim().min(1),
  public_visibility: z.enum(["public", "private"]),
  baseline: z.object({
    evidence_observation_ids: z.array(identifier).min(1),
    freshness_rule: z.string().trim().min(1),
    schema_shape: z.record(z.string(), z.string()),
    required_pointers: z.array(z.string()).default([]),
    identifier_pointer: z.string().nullable().optional(),
    identifier_pattern: z.string().nullable().optional(),
    provider_timestamp_pointer: z.string().nullable().optional(),
    max_age_seconds: z.number().int().positive().nullable().optional(),
    event_list_pointer: z.string().nullable().optional(),
    bilingual_primary_pointer: z.string().nullable().optional(),
    bilingual_peer_pointer: z.string().nullable().optional(),
    geometry_pointer: z.string().nullable().optional(),
    cursor_current_pointer: z.string().nullable().optional(),
    cursor_next_pointer: z.string().nullable().optional(),
  }),
});
const connectorActivationInput = z
  .object({
    connector_id: z.string().regex(/^[A-Z0-9][A-Z0-9._-]{2,127}$/),
    source_group_id: z.string().regex(/^P01-SG-(0[1-9]|10)$/),
    code_version: z.string().trim().min(1),
    recipe_reference: z.string().regex(/^HKAPI-[0-9]{3}$/),
    parameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).default({}),
    project: z.literal("P01"),
    purpose: z.literal("connector-observation"),
    cadence_seconds: z.number().int().positive().max(2_592_000),
    fixture_evidence_url: z.url(),
    live_probe_evidence_url: z.url(),
    reason: z.string().trim().min(1),
  });

function expectedVersion(header: string | string[] | undefined): number {
  const value = Array.isArray(header) ? header[0] : header;
  const match = value === undefined ? null : /^(?:W\/)?"?([1-9][0-9]*)"?$/.exec(value.trim());
  if (match?.[1] === undefined) {
    throw new HttpError(400, "INVALID_REQUEST", "If-Match must contain the current positive version");
  }
  return Number(match[1]);
}

function authenticated(principal: RequestPrincipal | null): RequestPrincipal {
  if (principal === null) {
    throw new HttpError(401, "UNAUTHENTICATED", "Bearer token is required");
  }
  requireMfa(principal);
  return principal;
}

export function registerAdminRoutes(app: FastifyInstance, context: RouteContext): void {
  app.get("/v1/admin/audit", async (request) => {
    await context.authenticate(request.headers.authorization, ["admin:sources"], false);
    const query = pageQuery.extend({ target_id: z.string().optional() }).parse(request.query);
    const result = await context.repository.listAudit({
      targetId: query.target_id,
      cursor: query.cursor,
      limit: query.limit,
    });
    return pageResponse(
      result.items.map((entry) => ({
        audit_id: entry.auditId,
        actor: entry.actor,
        action: entry.action,
        target_type: entry.targetType,
        target_id: entry.targetId,
        reason: entry.reason,
        before_hash: entry.beforeHash,
        after_hash: entry.afterHash,
        occurred_at: entry.occurredAt,
        metadata: entry.metadata,
      })),
      result.nextCursor,
    );
  });

  app.post("/v1/admin/sources/:source_id/approval-decisions", async (request, reply) => {
    const principal = authenticated(
      await context.authenticate(request.headers.authorization, ["admin:sources"], false),
    );
    const params = z.object({ source_id: identifier }).parse(request.params);
    const body = approvalInput.parse(request.body);
    const occurredAt = context.clock().toISOString();
    if (body.expires_at <= occurredAt) {
      throw new HttpError(400, "INVALID_REQUEST", "Approval expiry must be in the future");
    }
    const source = await context.repository.decideSourceApproval(
      {
        sourceId: params.source_id,
        decision: body.decision,
        projects: body.projects,
        purposes: body.purposes,
        storage: body.storage,
        retention: body.retention,
        redistribution: body.redistribution,
        attribution: body.attribution,
        evidenceUrls: body.evidence,
        expiresAt: body.expires_at,
        reason: body.reason,
        actor: principal.subject,
        decidedAt: occurredAt,
      },
      { expectedVersion: expectedVersion(request.headers["if-match"]) },
    );
    reply.header("etag", `"${source.version}"`);
    return reply.status(201).send(sourceResponse(source, context.operatingProfile));
  });

  app.post("/v1/admin/monitor-targets/:monitor_id/activate", async (request, reply) => {
    const principal = authenticated(
      await context.authenticate(request.headers.authorization, ["admin:incidents"], false),
    );
    const params = z.object({ monitor_id: identifier }).parse(request.params);
    const body = monitorActivationInput.parse(request.body);
    const target = await context.repository.activateMonitorTarget(
      {
        monitorId: params.monitor_id,
        actor: principal.subject,
        reason: body.reason,
        occurredAt: context.clock().toISOString(),
        operatorIdentity: body.operator_identity,
        ruleVersion: body.rule_version,
        publicVisibility: body.public_visibility,
        evidenceObservationIds: body.baseline.evidence_observation_ids,
        freshnessRule: body.baseline.freshness_rule,
        contentRules: {
          schema_shape: body.baseline.schema_shape,
          required_pointers: body.baseline.required_pointers,
          ...(body.baseline.identifier_pointer === undefined
            ? {}
            : { identifier_pointer: body.baseline.identifier_pointer }),
          ...(body.baseline.identifier_pattern === undefined
            ? {}
            : { identifier_pattern: body.baseline.identifier_pattern }),
          ...(body.baseline.provider_timestamp_pointer === undefined
            ? {}
            : { provider_timestamp_pointer: body.baseline.provider_timestamp_pointer }),
          ...(body.baseline.max_age_seconds === undefined
            ? {}
            : { max_age_seconds: body.baseline.max_age_seconds }),
          ...(body.baseline.event_list_pointer === undefined
            ? {}
            : { event_list_pointer: body.baseline.event_list_pointer }),
          ...(body.baseline.bilingual_primary_pointer === undefined
            ? {}
            : { bilingual_primary_pointer: body.baseline.bilingual_primary_pointer }),
          ...(body.baseline.bilingual_peer_pointer === undefined
            ? {}
            : { bilingual_peer_pointer: body.baseline.bilingual_peer_pointer }),
          ...(body.baseline.geometry_pointer === undefined
            ? {}
            : { geometry_pointer: body.baseline.geometry_pointer }),
          ...(body.baseline.cursor_current_pointer === undefined
            ? {}
            : { cursor_current_pointer: body.baseline.cursor_current_pointer }),
          ...(body.baseline.cursor_next_pointer === undefined
            ? {}
            : { cursor_next_pointer: body.baseline.cursor_next_pointer }),
        },
      },
      { expectedVersion: expectedVersion(request.headers["if-match"]) },
    );
    reply.header("etag", `"${target.version ?? 1}"`);
    return reply.status(201).send(targetResponse(target));
  });

  app.post("/v1/admin/sources/:source_id/connectors", async (request, reply) => {
    const principal = authenticated(
      await context.authenticate(request.headers.authorization, ["admin:sources"], false),
    );
    const params = z.object({ source_id: identifier }).parse(request.params);
    const body = connectorActivationInput.parse(request.body);
    if (body.recipe_reference !== params.source_id) {
      throw new HttpError(400, "INVALID_REQUEST", "Recipe reference must match the source ID");
    }
    const recipe = context.accessRecipes.get(body.recipe_reference);
    if (recipe === undefined) {
      throw new HttpError(400, "INVALID_REQUEST", "Recipe reference is not in the registry");
    }
    if (recipe.request === null || recipe.adapter === "none") {
      throw new HttpError(400, "INVALID_REQUEST", "Recipe is not executable");
    }
    const declaredParameters = new Set(recipe.request.parameters.map((item) => item.name));
    const unknownParameter = Object.keys(body.parameters).find(
      (name) => !declaredParameters.has(name),
    );
    if (unknownParameter !== undefined) {
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        `Parameter is not declared by the recipe: ${unknownParameter}`,
      );
    }
    const source = await context.repository.activateConnector(
      {
        sourceId: params.source_id,
        sourceGroupId: body.source_group_id,
        connectorId: body.connector_id,
        codeVersion: body.code_version,
        recipeReference: body.recipe_reference,
        parameters: body.parameters,
        project: body.project,
        purpose: body.purpose,
        cadenceSeconds: body.cadence_seconds,
        fixtureEvidenceUrl: body.fixture_evidence_url,
        liveProbeEvidenceUrl: body.live_probe_evidence_url,
        actor: principal.subject,
        reason: body.reason,
        occurredAt: context.clock().toISOString(),
      },
      { expectedVersion: expectedVersion(request.headers["if-match"]) },
    );
    reply.header("etag", `"${source.version}"`);
    return reply.status(201).send(sourceResponse(source, context.operatingProfile));
  });

  app.post("/v1/admin/incidents/:incident_id/acknowledge", async (request, reply) => {
    const principal = authenticated(
      await context.authenticate(request.headers.authorization, ["admin:incidents"], false),
    );
    const params = z.object({ incident_id: identifier }).parse(request.params);
    const body = reasonInput.parse(request.body);
    const incident = await context.repository.acknowledgeIncident(
      {
        incidentId: params.incident_id,
        actor: principal.subject,
        reason: body.reason,
        occurredAt: context.clock().toISOString(),
      },
      { expectedVersion: expectedVersion(request.headers["if-match"]) },
    );
    reply.header("etag", `"${incident.auditVersion}"`);
    return incidentResponse(incident);
  });

  app.post("/v1/admin/incidents/:incident_id/suppress", async (request, reply) => {
    const principal = authenticated(
      await context.authenticate(request.headers.authorization, ["admin:incidents"], false),
    );
    const params = z.object({ incident_id: identifier }).parse(request.params);
    const body = suppressionInput.parse(request.body);
    const occurredAt = context.clock().toISOString();
    const duration = Date.parse(body.expires_at) - Date.parse(occurredAt);
    if (duration <= 0 || duration > 30 * 24 * 60 * 60 * 1_000) {
      throw new HttpError(
        400,
        "INVALID_REQUEST",
        "Suppression expiry must be in the future and no more than 30 days away",
      );
    }
    const incident = await context.repository.suppressIncident(
      {
        incidentId: params.incident_id,
        actor: principal.subject,
        reason: body.reason,
        occurredAt,
        expiresAt: body.expires_at,
      },
      { expectedVersion: expectedVersion(request.headers["if-match"]) },
    );
    reply.header("etag", `"${incident.auditVersion}"`);
    return incidentResponse(incident);
  });

  app.post("/v1/admin/incidents/:incident_id/resolve", async (request, reply) => {
    const principal = authenticated(
      await context.authenticate(request.headers.authorization, ["admin:incidents"], false),
    );
    const params = z.object({ incident_id: identifier }).parse(request.params);
    const body = resolutionInput.parse(request.body);
    const incident = await context.repository.resolveIncident(
      {
        incidentId: params.incident_id,
        actor: principal.subject,
        reason: body.reason,
        occurredAt: context.clock().toISOString(),
        cause: body.cause,
        evidenceObservationIds: body.evidence_observation_ids,
      },
      { expectedVersion: expectedVersion(request.headers["if-match"]) },
    );
    reply.header("etag", `"${incident.auditVersion}"`);
    return incidentResponse(incident);
  });

  app.post("/v1/admin/incidents/:incident_id/publish", async (request, reply) => {
    const principal = authenticated(
      await context.authenticate(request.headers.authorization, ["admin:incidents"], false),
    );
    const params = z.object({ incident_id: identifier }).parse(request.params);
    const body = publicationInput.parse(request.body);
    const incident = await context.repository.publishIncident(
      {
        incidentId: params.incident_id,
        actor: principal.subject,
        reason: body.reason,
        occurredAt: context.clock().toISOString(),
        publicSummary: {
          en: body.public_summary.en,
          zhHant: body.public_summary.zh_Hant,
        },
      },
      { expectedVersion: expectedVersion(request.headers["if-match"]) },
    );
    reply.header("etag", `"${incident.auditVersion}"`);
    return incidentResponse(incident);
  });

  app.post("/v1/admin/incidents/:incident_id/correct", async (request, reply) => {
    const principal = authenticated(
      await context.authenticate(request.headers.authorization, ["admin:incidents"], false),
    );
    const params = z.object({ incident_id: identifier }).parse(request.params);
    const body = correctionInput.parse(request.body);
    const incident = await context.repository.correctIncident(
      {
        incidentId: params.incident_id,
        actor: principal.subject,
        reason: body.reason,
        occurredAt: context.clock().toISOString(),
        publicSummary: {
          en: body.public_summary.en,
          zhHant: body.public_summary.zh_Hant,
        },
        correctionReference: body.correction_reference,
      },
      { expectedVersion: expectedVersion(request.headers["if-match"]) },
    );
    reply.header("etag", `"${incident.auditVersion}"`);
    return incidentResponse(incident);
  });
}
