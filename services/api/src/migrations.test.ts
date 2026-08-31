import { describe, expect, it } from "vitest";
import { newDb } from "pg-mem";

import { applyMigrations, loadMigrations } from "./migrations.js";

describe("loadMigrations", () => {
  it("loads the platform migrations once in numeric order", () => {
    const migrations = loadMigrations();

    expect(migrations.map((migration) => migration.name)).toEqual([
      "000_extensions.sql",
      "001_platform.sql",
      "002_row_security.sql",
      "003_immutability.sql",
      "004_scheduler.sql",
      "005_webhook_outbox.sql",
      "006_operational_activation.sql",
      "007_provider_timestamp_semantics.sql",
      "008_runtime_kill_switches.sql",
      "009_runtime_roles.sql",
      "010_postgis_update.sql",
    ]);
    expect(new Set(migrations.map((migration) => migration.sha256)).size).toBe(11);
    expect(migrations.every((migration) => migration.sql.trim().endsWith(";"))).toBe(true);
  });

  it("applies each migration once and rejects a changed applied migration", async () => {
    const database = newDb({ noAstCoverageCheck: true });
    const adapter = database.adapters.createPg();
    const pool = new adapter.Pool();
    const migrations = [
      { name: "001_create.sql", sha256: "a".repeat(64), sql: "CREATE TABLE example (id text PRIMARY KEY);" },
      { name: "002_seed.sql", sha256: "b".repeat(64), sql: "INSERT INTO example (id) VALUES ('one');" },
    ];

    await applyMigrations(pool, migrations);
    await applyMigrations(pool, migrations);

    expect(Number((await pool.query("SELECT count(*)::int AS count FROM example")).rows[0]?.count))
      .toBe(1);
    await expect(
      applyMigrations(pool, [{ ...migrations[0]!, sha256: "c".repeat(64) }]),
    ).rejects.toThrowError(/changed after it was applied/i);
    await pool.end();
  });
});
