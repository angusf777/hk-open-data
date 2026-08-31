import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { RequestPrincipal, TokenVerifier } from "./auth.js";
import type {
  CanonicalEvent,
  Incident,
  MonitorObservation,
  MonitorTarget,
  SourceDefinition,
  SourceRecord,
} from "./domain.js";
import { MemoryPlatformRepository } from "./memory-repository.js";

const observedAt = "2026-08-28T10:00:00.000Z";

const source: SourceDefinition = {
  sourceId: "HKAPI-001",
  catalogueId: "official:hkapi-001",
  catalogueVerifiedAt: "2026-08-31",
  termsEvidenceState: "ambiguity-identified",
  projects: ["P01", "P14"],
  name: "DATA.GOV.HK CKAN package list",
  provider: "Digital Policy Office",
  authorityClass: "official",
  approvalStatus: "approved",
  visibility: "public",
  freshnessStatus: "fresh",
  lastSuccessAt: observedAt,
  documentationUrl: "https://data.gov.hk/en/help/ckan-api-development-guide",
  cadence: "daily",
  approvedUses: ["P01 beta"],
  limitations: ["Metadata, not dataset contents"],
  version: 2,
  createdAt: observedAt,
  updatedAt: observedAt,
};

const record: SourceRecord = {
  sourceRecordId: "SR-00000001",
  sourceId: "HKAPI-001",
  sourceGroupId: "P01-SG-01",
  provider: "Digital Policy Office",
  authorityClass: "official",
  retrievedAt: observedAt,
  catalogueId: "official:hkapi-001",
  termsEvidenceState: "ambiguity-identified",
  evidenceMode: "raw",
  contentType: "application/json",
  rawPayloadHash: "a".repeat(64),
  rawStorageUri: "s3://raw-snapshots/aa/source.json",
  approvalReference: "APP-HKAPI-001-2",
  schemaVersion: "1.0.0",
  freshnessStatus: "fresh",
  qualityFlags: [],
  parentRecordIds: [],
};

const event: CanonicalEvent = {
  eventId: "EV-00000001",
  eventType: "source.changed",
  status: "active",
  severity: "informational",
  title: { en: "Source changed", zhHant: "資料來源已變更" },
  summary: { en: "CKAN metadata changed", zhHant: "CKAN 元數據已變更" },
  observedAt,
  sourceRecords: [record.sourceRecordId],
  affectedEntities: ["HKAPI-001"],
  qualityFlags: [],
  schemaVersion: "1.0.0",
};

const publicTarget: MonitorTarget = {
  monitorId: "P14-M001",
  sourceId: "HKAPI-001",
  provider: "Digital Policy Office",
  name: "CKAN package list",
  outcome: "pass",
  lastCheckedAt: observedAt,
  publicVisibility: "public",
  baselineVersion: 1,
};

const privateTarget: MonitorTarget = {
  ...publicTarget,
  monitorId: "P14-M002",
  name: "CKAN package details",
  publicVisibility: "private",
};

const observation: MonitorObservation = {
  observationId: "OBS-00000001",
  monitorId: "P14-M001",
  outcome: "pass",
  startedAt: observedAt,
  finishedAt: observedAt,
  latencyMs: 120,
  httpStatus: 200,
  evidenceHash: "b".repeat(64),
  baselineVersion: "1",
  seededFailure: false,
  checkResults: [{ check: "availability", outcome: "pass", code: "HTTP_200" }],
};

const incident: Incident = {
  incidentId: "INC-2026-000001",
  sourceId: "HKAPI-001",
  status: "resolved",
  severity: "minor",
  category: "availability",
  monitorIds: ["P14-M001"],
  observationIds: ["OBS-00000001", "OBS-00000002"],
  openedAt: observedAt,
  lastObservedAt: observedAt,
  acknowledgedAt: observedAt,
  suppressionExpiresAt: null,
  resolvedAt: observedAt,
  publicState: "published",
  publicSummary: {
    en: "Historical CKAN timeout",
    zhHant: "過往 CKAN 逾時",
  },
  auditVersion: 3,
};

const principals: Record<string, RequestPrincipal> = {
  records: {
    subject: "records-viewer",
    tenantId: "tenant-1",
    scopes: new Set(["records:read"]),
    mfa: false,
  },
  status: {
    subject: "status-viewer",
    tenantId: "tenant-1",
    scopes: new Set(["status:read"]),
    mfa: false,
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

function app() {
  return buildApp({
    repository: new MemoryPlatformRepository({
      sources: [source],
      sourceRecords: [record],
      events: [event],
      monitorTargets: [publicTarget, privateTarget],
      observations: [observation],
      incidents: [incident],
    }),
    verifier,
    clock: () => new Date(observedAt),
    operatingProfile: "observe",
  });
}

describe("REST read surface", () => {
  it("exposes live, dependency-ready and Prometheus-compatible probes", async () => {
    const instance = app();
    const live = await instance.inject({ method: "GET", url: "/health/live" });
    const ready = await instance.inject({ method: "GET", url: "/health/ready" });
    const metrics = await instance.inject({ method: "GET", url: "/metrics" });

    expect(live.json()).toEqual({ status: "live", operating_profile: "observe" });
    expect(ready.json()).toEqual({ status: "ready", operating_profile: "observe" });
    expect(metrics.headers["content-type"]).toContain("text/plain");
    expect(metrics.body).toContain("hk_platform_http_requests_completed_total");
    expect(metrics.body).toContain("hk_platform_scheduler_backlog 0");
    expect(metrics.body).toContain("hk_platform_failed_webhooks 0");
  });

  it("reports profile and terms evidence without claiming permission", async () => {
    const response = await app().inject({ method: "GET", url: "/v1/sources/HKAPI-001" });

    expect(response.json()).toMatchObject({
      catalogue_id: "official:hkapi-001",
      terms_evidence_state: "ambiguity-identified",
      catalogue_verified_at: "2026-08-31",
      operating_profile: "observe",
    });
    expect(JSON.stringify(response.json())).not.toMatch(
      /commercial use allowed|safe to cache|redistribution allowed/i,
    );
  });

  it("returns a reviewed public status summary without a token", async () => {
    const response = await app().inject({ method: "GET", url: "/v1/status/summary" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      generated_at: observedAt,
      overall: "operational",
      counts: { pass: 1 },
      current_incidents: [],
    });
  });

  it("rejects source-record reads without records:read", async () => {
    const response = await app().inject({ method: "GET", url: "/v1/source-records" });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ code: "UNAUTHENTICATED", retryable: false });
  });

  it("returns evidence-wrapped records to an authorized caller", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/v1/source-records?source_id=HKAPI-001&limit=20",
      headers: { authorization: "Bearer records" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      items: [
        {
          source_record_id: record.sourceRecordId,
          source_id: "HKAPI-001",
          catalogue_id: "official:hkapi-001",
          terms_evidence_state: "ambiguity-identified",
          evidence_mode: "raw",
          retrieved_at: observedAt,
        },
      ],
      page: { next_cursor: null },
    });
  });

  it("shows only reviewed public targets anonymously and private targets with status scope", async () => {
    const anonymous = await app().inject({ method: "GET", url: "/v1/monitor-targets" });
    const authorized = await app().inject({
      method: "GET",
      url: "/v1/monitor-targets",
      headers: { authorization: "Bearer status" },
    });

    expect(anonymous.json().items.map((item: { monitor_id: string }) => item.monitor_id)).toEqual([
      "P14-M001",
    ]);
    expect(authorized.json().items.map((item: { monitor_id: string }) => item.monitor_id)).toEqual([
      "P14-M001",
      "P14-M002",
    ]);
  });

  it("returns 404 for a target hidden from an anonymous caller", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/v1/monitor-targets/P14-M002",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects out-of-range pagination and supplies a correlation id", async () => {
    const response = await app().inject({
      method: "GET",
      url: "/v1/monitor-targets?limit=201",
    });

    expect(response.statusCode).toBe(400);
    expect(response.headers["x-correlation-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
