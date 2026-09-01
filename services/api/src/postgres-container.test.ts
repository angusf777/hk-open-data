import { PostgreSqlContainer, type StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyMigrations } from "./migrations.js";
import { buildSeedData } from "./seed-data.js";
import { seedDatabase } from "./seed.js";
import { PostgresWebhookStore, WebhookSecretProtector } from "./webhooks/postgres-store.js";

const dockerEnabled = process.env.RUN_DOCKER_TESTS === "1";
const postgresImage = process.env.POSTGRES_TEST_IMAGE ?? "postgis/postgis:16-3.5-alpine";

describe.skipIf(!dockerEnabled)("PostgreSQL 16/PostGIS integration", () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let tenantPool: Pool;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(postgresImage)
      .withEnvironment({
        POSTGRES_APP_PASSWORD: "app-runtime-test",
        POSTGRES_WEBHOOK_PASSWORD: "webhook-runtime-test",
      })
      .start();
    pool = new Pool({ connectionString: container.getConnectionUri() });
    await applyMigrations(pool);
    await pool.query(
      "CREATE ROLE tenant_runtime LOGIN PASSWORD 'tenant-runtime-test' NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS",
    );
    await pool.query("GRANT USAGE ON SCHEMA public TO tenant_runtime");
    await pool.query("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO tenant_runtime");
    await pool.query("GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO tenant_runtime");
    const tenantUrl = new URL(container.getConnectionUri());
    tenantUrl.username = "tenant_runtime";
    tenantUrl.password = "tenant-runtime-test";
    tenantPool = new Pool({ connectionString: tenantUrl.toString() });
  }, 120_000);

  afterAll(async () => {
    await tenantPool?.end();
    await pool?.end();
    await container?.stop();
  });

  it("runs all migrations and seeds the pending registry", async () => {
    await seedDatabase(pool, buildSeedData("2026-08-28T10:00:00.000Z"));

    expect((await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM schema_migration")).rows[0]?.count).toBe(11);
    expect((await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM source_definition")).rows[0]?.count).toBe(22);
    expect((await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM monitor_target")).rows[0]?.count).toBe(50);
    expect((await pool.query<{ count: number }>("SELECT count(*)::int AS count FROM pg_extension WHERE extname = 'postgis'")).rows[0]?.count).toBe(1);
  }, 120_000);

  it("enforces two-tenant subscription isolation for the non-owner runtime role", async () => {
    const store = new PostgresWebhookStore(
      tenantPool,
      new WebhookSecretProtector("Y2ktb25seS0zMi1ieXRlLWtleS0wMTIzNDU2Nzg5MDE="),
    );
    const first = await store.createSubscription({
      tenantId: "tenant-a",
      endpoint: "https://tenant-a.example/webhook",
      eventTypes: ["source.changed"],
      sourceIds: [],
      idempotencyKey: "tenant-a-idempotency-key",
      secret: "tenant-a-secret",
      now: "2026-08-28T10:00:00.000Z",
    });
    await store.createSubscription({
      tenantId: "tenant-b",
      endpoint: "https://tenant-b.example/webhook",
      eventTypes: ["source.changed"],
      sourceIds: [],
      idempotencyKey: "tenant-b-idempotency-key",
      secret: "tenant-b-secret",
      now: "2026-08-28T10:00:00.000Z",
    });

    expect((await store.listSubscriptions("tenant-a", 20)).map((item) => item.tenantId)).toEqual([
      "tenant-a",
    ]);
    expect((await store.listSubscriptions("tenant-b", 20)).map((item) => item.tenantId)).toEqual([
      "tenant-b",
    ]);
    expect(await store.getSubscription(first.subscriptionId, "tenant-b")).toBeNull();
  }, 120_000);

  it("rejects updates and deletes of raw evidence and audit entries", async () => {
    const digest = "a".repeat(64);
    await pool.query(
      `INSERT INTO raw_object (
         raw_object_id, object_uri, sha256, media_type, size_bytes,
         encryption_state, retention_class, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        "RAW-immutability-test",
        "s3://evidence/raw/immutability-test",
        digest,
        "application/octet-stream",
        1,
        "encrypted",
        "evidence",
        "2026-08-28T10:00:00.000Z",
      ],
    );
    await pool.query(
      `INSERT INTO audit_entry (
         audit_id, actor, action, target_type, target_id, reason,
         before_hash, after_hash, occurred_at, metadata
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        "AUD-immutability-test",
        "integration-test",
        "verify",
        "raw_object",
        "RAW-immutability-test",
        "prove database immutability triggers",
        "0".repeat(64),
        "1".repeat(64),
        "2026-08-28T10:00:00.000Z",
        {},
      ],
    );

    await expect(
      pool.query("UPDATE raw_object SET media_type = 'text/plain' WHERE raw_object_id = $1", [
        "RAW-immutability-test",
      ]),
    ).rejects.toThrow("raw_object rows are immutable");
    await expect(
      pool.query("DELETE FROM raw_object WHERE raw_object_id = $1", ["RAW-immutability-test"]),
    ).rejects.toThrow("raw_object rows are immutable");
    await expect(
      pool.query("UPDATE audit_entry SET reason = 'changed' WHERE audit_id = $1", [
        "AUD-immutability-test",
      ]),
    ).rejects.toThrow("audit_entry rows are immutable");
    await expect(
      pool.query("DELETE FROM audit_entry WHERE audit_id = $1", ["AUD-immutability-test"]),
    ).rejects.toThrow("audit_entry rows are immutable");
  }, 120_000);
});
