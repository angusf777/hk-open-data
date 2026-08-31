import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DataType, newDb } from "pg-mem";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createPostgresRepository } from "./postgres-repository.js";
import type { PlatformRepository } from "./repository.js";

const now = "2026-08-28T10:00:00.000Z";
const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations/001_platform.sql",
);

describe("PostgresPlatformRepository", () => {
  let close: (() => Promise<void>) | undefined;
  let repository: PlatformRepository;

  beforeEach(async () => {
    const database = newDb({ autoCreateForeignKeyIndices: true });
    database.public.registerFunction({
      name: "length",
      args: [DataType.text],
      returns: DataType.integer,
      implementation: (value: string) => value.length,
    });
    database.public.none(readFileSync(migrationPath, "utf8"));
    const adapter = database.adapters.createPg();
    const pool = new adapter.Pool();
    close = () => pool.end();
    repository = createPostgresRepository(pool);
    await pool.query(
      `INSERT INTO source_group (
        source_group_id, name, provider, source_ids, operator_hint, status,
        created_at, updated_at, version
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, 1)`,
      [
        "P01-SG-01",
        "DATA.GOV.HK catalogue",
        "Digital Policy Office",
        ["HKAPI-001"],
        "Catalogue connector owner",
        "approved",
        now,
      ],
    );
    await pool.query(
      `INSERT INTO source_definition (
        source_id, source_group_id, projects, name, provider, authority_class, approval_status,
        visibility, freshness_status, documentation_url, cadence, approved_uses,
        limitations, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 1, $14, $14)`,
      [
        "HKAPI-001",
        "P01-SG-01",
        ["P01"],
        "DATA.GOV.HK CKAN",
        "Digital Policy Office",
        "official",
        "specified_pending_approval",
        "private",
        "unknown",
        "https://data.gov.hk/en/help/ckan-api-development-guide",
        "daily",
        [],
        [],
        now,
      ],
    );
    await pool.query(
      `INSERT INTO raw_object (
        raw_object_id, object_uri, sha256, media_type, size_bytes,
        encryption_state, retention_class, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        "RAW-00000001",
        "s3://raw-snapshots/aa/source.json",
        "a".repeat(64),
        "application/json",
        100,
        "encrypted",
        "rights-specific",
        now,
      ],
    );
    await pool.query(
      `INSERT INTO connector_definition (
        connector_id, source_group_id, code_version, supported_source_ids,
        configuration_schema, enabled, created_at, updated_at, version
      ) VALUES ($1, $2, $3, $4, $5, true, $6, $6, 1)`,
      ["CONN-00000001", "P01-SG-01", "1.0.0", ["HKAPI-001"], {}, now],
    );
    await pool.query(
      `INSERT INTO connector_run (
        connector_run_id, connector_id, source_id, code_version, status,
        started_at, finished_at, request_fingerprint, response_metadata,
        raw_object_ids, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $6, $7, $8, $9, $6)`,
      [
        "CR-00000001",
        "CONN-00000001",
        "HKAPI-001",
        "1.0.0",
        "success",
        now,
        "request-hash",
        { status: 200 },
        ["RAW-00000001"],
      ],
    );
    await pool.query(
      `INSERT INTO source_record (
        source_record_id, source_id, connector_run_id, raw_object_id,
        approval_reference, schema_version, retrieved_at, observed_at,
        freshness_status, quality_flags, record_data, record_hash,
        parent_source_record_ids, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8, $9, $10, $11, $12, $7)`,
      [
        "SR-00000001",
        "HKAPI-001",
        "CR-00000001",
        "RAW-00000001",
        "APP-HKAPI-001-2",
        "1.0.0",
        now,
        "fresh",
        [],
        {},
        "b".repeat(64),
        [],
      ],
    );
    await pool.query(
      `INSERT INTO canonical_event (
        canonical_event_id, event_type, event_version, status, severity,
        observed_at, event_data, evidence_source_record_ids, created_at
      ) VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $5)`,
      [
        "EV-00000001",
        "source.changed",
        "active",
        "informational",
        now,
        {
          title: { en: "Source changed", zh_Hant: "資料來源已變更" },
          summary: { en: "Metadata changed", zh_Hant: "元數據已變更" },
          quality_flags: [],
          schema_version: "1.0.0",
        },
        ["SR-00000001"],
      ],
    );
    await pool.query(
      `INSERT INTO monitor_target (
        monitor_id, source_id, source_group_id, provider, name, method,
        request_template, cadence_seconds, timeout_ms, freshness_rule,
        required_checks, public_visibility, activation_status,
        documentation_url, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, 'GET', $6, 60, 1000, $7, $8, 'public', 'approved', $9, 1, $10, $10)`,
      [
        "P14-M001",
        "HKAPI-001",
        "P01-SG-01",
        "Digital Policy Office",
        "CKAN package list",
        "https://data.gov.hk/en-data/api/3/action/package_list?limit=1",
        "retrieval_only",
        ["availability", "json"],
        "https://data.gov.hk/en/help/ckan-api-development-guide",
        now,
      ],
    );
    await pool.query(
      `INSERT INTO monitor_observation (
        observation_id, monitor_id, outcome, started_at, finished_at,
        latency_ms, http_status, evidence_json, created_at
      ) VALUES ($1, $2, 'pass', $3, $3, 120, 200, $4, $3)`,
      [
        "OBS-00000001",
        "P14-M001",
        now,
        {
          evidence_hash: "c".repeat(64),
          baseline_version: "1",
          seeded_failure: false,
          check_results: [{ check: "availability", outcome: "pass", code: "HTTP_200" }],
        },
      ],
    );
    await pool.query(
      `INSERT INTO monitor_observation (
        observation_id, monitor_id, outcome, started_at, finished_at,
        latency_ms, http_status, evidence_json, created_at
      ) VALUES ($1, $2, 'pass', $3, $3, 110, 200, $4, $3)`,
      [
        "OBS-00000002",
        "P14-M001",
        now,
        {
          evidence_hash: "d".repeat(64),
          baseline_version: "1",
          seeded_failure: false,
          check_results: [{ check: "availability", outcome: "pass", code: "HTTP_200" }],
        },
      ],
    );
    await pool.query(
      `INSERT INTO incident (
        incident_id, source_id, status, severity, category, monitor_ids,
        observation_ids, opened_at, last_observed_at, public_state,
        public_summary, audit_version, created_at, updated_at
      ) VALUES ($1, $2, 'resolved', 'minor', 'availability', $3, $4, $5, $5, 'published', $6, 2, $5, $5)`,
      [
        "INC-2026-000001",
        "HKAPI-001",
        ["P14-M001"],
        ["OBS-00000001"],
        now,
        { en: "Historical timeout", zh_Hant: "過往逾時" },
      ],
    );
    await pool.query(
      `INSERT INTO incident (
        incident_id, source_id, status, severity, category, monitor_ids,
        observation_ids, opened_at, last_observed_at, public_state,
        audit_version, created_at, updated_at
      ) VALUES ($1, $2, 'open', 'major', 'availability', $3, $4, $5, $5,
        'review_required', 1, $5, $5)`,
      ["INC-2026-000002", "HKAPI-001", ["P14-M001"], ["OBS-00000001"], now],
    );
  });

  afterEach(async () => {
    await close?.();
  });

  it("persists an approval and its audit entry atomically", async () => {
    const decided = await repository.decideSourceApproval(
      {
        sourceId: "HKAPI-001",
        decision: "approved",
        projects: ["P01"],
        purposes: ["P01 beta"],
        storage: "immutable raw and normalized metadata",
        retention: "rights-specific",
        redistribution: "reviewed fields only",
        attribution: "provider attribution required",
        evidenceUrls: ["https://example.gov.hk/review/1"],
        expiresAt: "2027-08-28T10:00:00.000Z",
        reason: "Source terms reviewed",
        actor: "reviewer@example.gov.hk",
        decidedAt: now,
      },
      { expectedVersion: 1 },
    );
    const audit = await repository.listAudit({ targetId: "HKAPI-001", limit: 20 });

    expect(decided).toMatchObject({ approvalStatus: "approved", version: 2 });
    expect(audit.items).toHaveLength(1);
    expect(audit.items[0]).toMatchObject({
      action: "source.approval_decided",
      targetId: "HKAPI-001",
      actor: "reviewer@example.gov.hk",
    });
  });

  it("does not write audit when the expected version is stale", async () => {
    await expect(
      repository.decideSourceApproval(
        {
          sourceId: "HKAPI-001",
          decision: "approved",
          projects: ["P01"],
          purposes: ["P01 beta"],
          storage: "immutable raw and normalized metadata",
          retention: "rights-specific",
          redistribution: "reviewed fields only",
          attribution: "provider attribution required",
          evidenceUrls: ["https://example.gov.hk/review/1"],
          expiresAt: "2027-08-28T10:00:00.000Z",
          reason: "Source terms reviewed",
          actor: "reviewer@example.gov.hk",
          decidedAt: now,
        },
        { expectedVersion: 9 },
      ),
    ).rejects.toMatchObject({ code: "VERSION_CONFLICT" });

    expect((await repository.listAudit({ targetId: "HKAPI-001", limit: 20 })).items).toEqual([]);
  });

  it("persists incident acknowledgement and its audit entry atomically", async () => {
    const acknowledged = await repository.acknowledgeIncident(
      {
        incidentId: "INC-2026-000002",
        actor: "operator@example.gov.hk",
        reason: "Operator accepted ownership",
        occurredAt: now,
      },
      { expectedVersion: 1 },
    );

    expect(acknowledged).toMatchObject({ status: "acknowledged", auditVersion: 2 });
    expect((await repository.listAudit({ targetId: "INC-2026-000002", limit: 20 })).items)
      .toMatchObject([{ action: "incident.acknowledged", actor: "operator@example.gov.hk" }]);
  });

  it("resolves an incident only against two healthy observations", async () => {
    const resolved = await repository.resolveIncident(
      {
        incidentId: "INC-2026-000002",
        actor: "operator@example.gov.hk",
        reason: "Recovery confirmed",
        cause: "Provider timeout",
        evidenceObservationIds: ["OBS-00000001", "OBS-00000002"],
        occurredAt: now,
      },
      { expectedVersion: 1 },
    );

    expect(resolved).toMatchObject({
      status: "resolved",
      auditVersion: 2,
      resolvedBy: "operator@example.gov.hk",
    });
  });

  it("reads records, events, monitor evidence, incidents and public status", async () => {
    expect((await repository.listSourceRecords({ sourceId: "HKAPI-001", limit: 20 })).items)
      .toMatchObject([{ sourceRecordId: "SR-00000001", rawPayloadHash: "a".repeat(64) }]);
    expect((await repository.listEvents({ eventType: "source.changed", limit: 20 })).items)
      .toMatchObject([{ eventId: "EV-00000001", severity: "informational" }]);
    expect((await repository.listMonitorTargets({ visibility: "public", limit: 20 })).items)
      .toMatchObject([{ monitorId: "P14-M001", outcome: "pass" }]);
    expect((await repository.getMonitorTarget("P14-M001", "public", 20))?.observations)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ observationId: "OBS-00000001", httpStatus: 200 }),
      ]));
    expect((await repository.listIncidents({ visibility: "public", limit: 20 })).items)
      .toMatchObject([{ incidentId: "INC-2026-000001", status: "resolved" }]);
    expect(await repository.getStatusSummary(now)).toMatchObject({
      overall: "operational",
      counts: { pass: 1 },
      currentIncidents: [],
    });
  });
});
