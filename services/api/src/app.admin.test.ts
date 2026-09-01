import { describe, expect, it } from "vitest";
import type { AccessRecipe } from "@hk-open-data/schemas";

import { buildApp } from "./app.js";
import type { RequestPrincipal, TokenVerifier } from "./auth.js";
import type { Incident, MonitorObservation, MonitorTarget, SourceDefinition } from "./domain.js";
import { MemoryPlatformRepository } from "./memory-repository.js";

const now = "2026-08-28T10:00:00.000Z";

const source: SourceDefinition = {
  sourceId: "HKAPI-001",
  sourceGroupId: "P01-SG-01",
  projects: ["P01", "P14"],
  name: "DATA.GOV.HK CKAN package list",
  provider: "Digital Policy Office",
  authorityClass: "official",
  approvalStatus: "specified_pending_approval",
  visibility: "private",
  freshnessStatus: "unknown",
  lastSuccessAt: null,
  documentationUrl: "https://data.gov.hk/en/help/ckan-api-development-guide",
  cadence: "daily",
  approvedUses: [],
  limitations: [],
  version: 1,
  createdAt: now,
  updatedAt: now,
};

const connectorBody = {
  connector_id: "CONN-P01-SG-01-V1",
  source_group_id: "P01-SG-01",
  code_version: "1.0.0",
  recipe_reference: "HKAPI-001",
  parameters: { limit: 10, offset: 0 },
  project: "P01",
  purpose: "connector-observation",
  cadence_seconds: 86400,
  fixture_evidence_url: "https://evidence.example.gov.hk/fixtures/P01-SG-01/1",
  live_probe_evidence_url: "https://evidence.example.gov.hk/probes/P01-SG-01/1",
  reason: "Fixture and live-sandbox probe reviewed",
};

const accessRecipe: AccessRecipe = {
  schemaVersion: 1,
  sourceReference: "HKAPI-001",
  recipeVersion: "1.0.0",
  adapter: "ckan-action",
  status: "fixture-tested",
  documentationUrl: "https://data.gov.hk/en/help/ckan-api-development-guide",
  limitations: ["Technical access example only."],
  authentication: { type: "none", environmentVariables: [], setup: null },
  request: {
    method: "GET",
    urlTemplate: "https://data.gov.hk/en-data/api/3/action/package_list",
    allowedHosts: ["data.gov.hk"],
    parameters: [
      {
        name: "limit",
        location: "query",
        dataType: "integer",
        required: false,
        default: 10,
        example: 10,
        description: "Maximum dataset identifiers returned.",
        enum: [],
      },
      {
        name: "offset",
        location: "query",
        dataType: "integer",
        required: false,
        default: 0,
        example: 0,
        description: "Dataset identifier offset.",
        enum: [],
      },
    ],
    headers: [{ name: "accept", value: "application/json", environmentVariable: null }],
    bodyTemplate: null,
    timeoutMs: 15_000,
    maxResponseBytes: 1_048_576,
    maxPages: 1,
    retry: { attempts: 2, statusCodes: [408, 429, 500, 502, 503, 504] },
  },
  response: {
    mediaTypes: ["application/json"],
    recordPath: "/result",
    idPath: null,
    timestampPath: null,
    pagination: { strategy: "none", nextPath: null },
    normalization: { fields: {}, language: null, geometry: null, timestamp: null },
  },
  reason: null,
  nextAction: null,
};

const incident: Incident = {
  incidentId: "INC-2026-000001",
  sourceId: "HKAPI-001",
  status: "open",
  severity: "major",
  category: "availability",
  monitorIds: ["P14-M001"],
  observationIds: ["OBS-00000001"],
  openedAt: now,
  lastObservedAt: now,
  publicState: "review_required",
  auditVersion: 1,
};

const monitorTarget: MonitorTarget = {
  monitorId: "P14-M001",
  sourceId: "HKAPI-001",
  provider: "Digital Policy Office",
  name: "CKAN package list",
  outcome: "unknown",
  lastCheckedAt: null,
  publicVisibility: "pending_review",
  baselineVersion: null,
  activationStatus: "specified_pending_approval",
  operatorIdentity: null,
  ruleVersion: null,
  version: 1,
};

function healthyObservation(observationId: string): MonitorObservation {
  return {
    observationId,
    monitorId: "P14-M001",
    startedAt: now,
    finishedAt: now,
    outcome: "pass",
    checkResults: [{ check: "availability", outcome: "pass", code: "HTTP_200" }],
    latencyMs: 100,
    evidenceHash: "a".repeat(64),
    baselineVersion: "1",
    seededFailure: false,
  };
}

const principals: Record<string, RequestPrincipal> = {
  viewer: { subject: "viewer", tenantId: null, scopes: new Set(), mfa: false },
  approver: {
    subject: "approver@example.gov.hk",
    tenantId: null,
    scopes: new Set(["admin:sources"]),
    mfa: true,
  },
  "approver-no-mfa": {
    subject: "approver@example.gov.hk",
    tenantId: null,
    scopes: new Set(["admin:sources"]),
    mfa: false,
  },
  operator: {
    subject: "operator@example.gov.hk",
    tenantId: null,
    scopes: new Set(["admin:incidents"]),
    mfa: true,
  },
};

const verifier: TokenVerifier = {
  async verify(token) {
    const principal = principals[token];
    if (principal === undefined) {
      throw new Error("invalid token");
    }
    return principal;
  },
};

function setup() {
  const repository = new MemoryPlatformRepository({
    sources: [source],
    incidents: [incident],
    monitorTargets: [monitorTarget],
    observations: [healthyObservation("OBS-00000001"), healthyObservation("OBS-00000002")],
  });
  return {
    repository,
    app: buildApp({
      repository,
      verifier,
      clock: () => new Date(now),
      accessRecipes: [accessRecipe],
    }),
  };
}

const approvalBody = {
  decision: "approved",
  projects: ["P01", "P14"],
  purposes: ["connector-observation", "quality-monitoring"],
  storage: "immutable raw and normalized metadata",
  retention: "rights-specific",
  redistribution: "reviewed fields only",
  attribution: "provider attribution required",
  evidence: ["https://example.gov.hk/review/1"],
  expires_at: "2027-08-28T10:00:00.000Z",
  reason: "Source terms and operating limits reviewed",
};

const activationBody = {
  reason: "Operator, rules, visibility, and evidence baseline are complete",
  operator_identity: "local-operator",
  rule_version: "quality-rules@1.0.0",
  public_visibility: "private",
  baseline: {
    evidence_observation_ids: ["OBS-00000001"],
    freshness_rule: "retrieval_only",
    schema_shape: { "/": "object" },
    required_pointers: [],
  },
};

describe("audited administrative routes", () => {
  it("requires admin:sources and an expected version", async () => {
    const { app } = setup();
    const forbidden = await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/approval-decisions",
      headers: { authorization: "Bearer viewer", "if-match": "1" },
      payload: approvalBody,
    });
    const missingVersion = await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/approval-decisions",
      headers: { authorization: "Bearer approver" },
      payload: approvalBody,
    });
    const missingMfa = await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/approval-decisions",
      headers: { authorization: "Bearer approver-no-mfa", "if-match": "1" },
      payload: approvalBody,
    });

    expect(forbidden.statusCode).toBe(403);
    expect(missingVersion.statusCode).toBe(400);
    expect(missingMfa.statusCode).toBe(403);
    expect(missingMfa.json()).toMatchObject({ message: expect.stringMatching(/MFA/) });
  });

  it("records a normative source approval and audit entry", async () => {
    const { app, repository } = setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/approval-decisions",
      headers: { authorization: "Bearer approver", "if-match": "1" },
      payload: approvalBody,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ source_id: "HKAPI-001", approval_status: "approved" });
    expect((await repository.listAudit({ targetId: "HKAPI-001", limit: 20 })).items)
      .toMatchObject([{ actor: "approver@example.gov.hk", action: "source.approval_decided" }]);
  });

  it("denies target activation until approval and then records the reviewed baseline", async () => {
    const { app, repository } = setup();
    const denied = await app.inject({
      method: "POST",
      url: "/v1/admin/monitor-targets/P14-M001/activate",
      headers: { authorization: "Bearer operator", "if-match": "1" },
      payload: activationBody,
    });
    expect(denied.statusCode).toBe(400);
    expect(denied.json()).toMatchObject({ code: "INVALID_STATE" });

    const approved = await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/approval-decisions",
      headers: { authorization: "Bearer approver", "if-match": "1" },
      payload: approvalBody,
    });
    expect(approved.statusCode).toBe(201);
    const activated = await app.inject({
      method: "POST",
      url: "/v1/admin/monitor-targets/P14-M001/activate",
      headers: { authorization: "Bearer operator", "if-match": "1" },
      payload: activationBody,
    });

    expect(activated.statusCode).toBe(201);
    expect(activated.json()).toMatchObject({
      monitor_id: "P14-M001",
      activation_status: "approved",
      baseline_version: 1,
      operator_identity: "local-operator",
      rule_version: "quality-rules@1.0.0",
      version: 2,
    });
    expect((await repository.listAudit({ targetId: "P14-M001", limit: 20 })).items)
      .toMatchObject([{ action: "monitor.activated", targetType: "monitor_target" }]);
  });

  it("activates an exact connector version only after purpose-scoped approval", async () => {
    const { app, repository } = setup();
    const denied = await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/connectors",
      headers: { authorization: "Bearer approver", "if-match": "1" },
      payload: connectorBody,
    });
    expect(denied.statusCode).toBe(400);

    await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/approval-decisions",
      headers: { authorization: "Bearer approver", "if-match": "1" },
      payload: approvalBody,
    });
    const activated = await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/connectors",
      headers: { authorization: "Bearer approver", "if-match": "2" },
      payload: connectorBody,
    });

    expect(activated.statusCode).toBe(201);
    expect(activated.json()).toMatchObject({ source_id: "HKAPI-001", version: 3 });
    expect((await repository.listAudit({ targetId: "CONN-P01-SG-01-V1", limit: 20 })).items)
      .toMatchObject([{ action: "connector.activated", targetType: "connector_definition" }]);
  });

  it("rejects a connector recipe mismatch and undeclared parameter", async () => {
    const { app } = setup();
    const mismatch = await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/connectors",
      headers: { authorization: "Bearer approver", "if-match": "1" },
      payload: { ...connectorBody, recipe_reference: "HKAPI-002" },
    });
    const unknown = await app.inject({
      method: "POST",
      url: "/v1/admin/sources/HKAPI-001/connectors",
      headers: { authorization: "Bearer approver", "if-match": "1" },
      payload: { ...connectorBody, parameters: { arbitrary_url: "https://example.com" } },
    });

    expect(mismatch.statusCode).toBe(400);
    expect(mismatch.json()).toMatchObject({ code: "INVALID_REQUEST" });
    expect(unknown.statusCode).toBe(400);
    expect(unknown.json()).toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("acknowledges an open incident with audited version increment", async () => {
    const { app } = setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/incidents/INC-2026-000001/acknowledge",
      headers: { authorization: "Bearer operator", "if-match": "1" },
      payload: { reason: "Operator accepted ownership" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "acknowledged", audit_version: 2 });
  });

  it("rejects an unbounded suppression", async () => {
    const { app } = setup();
    const response = await app.inject({
      method: "POST",
      url: "/v1/admin/incidents/INC-2026-000001/suppress",
      headers: { authorization: "Bearer operator", "if-match": "1" },
      payload: { reason: "Maintenance", expires_at: "2027-08-28T10:00:00.000Z" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ code: "INVALID_REQUEST" });
  });

  it("resolves only with two healthy observations", async () => {
    const first = setup();
    const insufficient = await first.app.inject({
      method: "POST",
      url: "/v1/admin/incidents/INC-2026-000001/resolve",
      headers: { authorization: "Bearer operator", "if-match": "1" },
      payload: {
        reason: "Recovered",
        cause: "Provider timeout",
        evidence_observation_ids: ["OBS-00000001"],
      },
    });
    const second = setup();
    const resolved = await second.app.inject({
      method: "POST",
      url: "/v1/admin/incidents/INC-2026-000001/resolve",
      headers: { authorization: "Bearer operator", "if-match": "1" },
      payload: {
        reason: "Recovered",
        cause: "Provider timeout",
        evidence_observation_ids: ["OBS-00000001", "OBS-00000002"],
      },
    });

    expect(insufficient.statusCode).toBe(400);
    expect(resolved.statusCode).toBe(200);
    expect(resolved.json()).toMatchObject({ status: "resolved", audit_version: 2 });
  });

  it("requires reviewed bilingual publication and retains prior wording on correction", async () => {
    const { app, repository } = setup();
    const incomplete = await app.inject({
      method: "POST",
      url: "/v1/admin/incidents/INC-2026-000001/publish",
      headers: { authorization: "Bearer operator", "if-match": "1" },
      payload: { reason: "Public update", public_summary: { en: "Provider unavailable" } },
    });
    expect(incomplete.statusCode).toBe(400);

    const published = await app.inject({
      method: "POST",
      url: "/v1/admin/incidents/INC-2026-000001/publish",
      headers: { authorization: "Bearer operator", "if-match": "1" },
      payload: {
        reason: "Reviewed public update",
        public_summary: { en: "Provider unavailable", zh_Hant: "供應方暫時未能使用" },
      },
    });
    expect(published.statusCode).toBe(200);
    expect(published.json()).toMatchObject({ public_state: "published", audit_version: 2 });

    const corrected = await app.inject({
      method: "POST",
      url: "/v1/admin/incidents/INC-2026-000001/correct",
      headers: { authorization: "Bearer operator", "if-match": "2" },
      payload: {
        reason: "Provider clarified scope",
        correction_reference: "CORR-2026-000001",
        public_summary: { en: "One endpoint unavailable", zh_Hant: "其中一個端點暫時未能使用" },
      },
    });
    expect(corrected.statusCode).toBe(200);
    expect(corrected.json()).toMatchObject({
      public_state: "corrected",
      correction_reference: "CORR-2026-000001",
      audit_version: 3,
    });
    const audit = await repository.listAudit({ targetId: "INC-2026-000001", limit: 20 });
    expect(audit.items.at(-1)?.metadata).toMatchObject({
      priorPublicSummary: { en: "Provider unavailable", zhHant: "供應方暫時未能使用" },
      correctionReference: "CORR-2026-000001",
    });
  });
});
