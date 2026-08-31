import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { QueryResultRow } from "pg";

import type { PostgresPool } from "./postgres.js";

export interface Migration {
  name: string;
  sha256: string;
  sql: string;
}

interface AppliedMigrationRow extends QueryResultRow {
  sha256: string;
}

const defaultMigrationDirectory = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

export function loadMigrations(directory = defaultMigrationDirectory): Migration[] {
  return readdirSync(directory)
    .filter((name) => /^[0-9]{3}_[a-z0-9_]+\.sql$/.test(name))
    .sort()
    .map((name) => {
      const sql = readFileSync(resolve(directory, name), "utf8");
      return {
        name,
        sha256: createHash("sha256").update(sql).digest("hex"),
        sql,
      };
    });
}

export async function applyMigrations(
  pool: PostgresPool,
  migrations = loadMigrations(),
): Promise<void> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migration (
       name text PRIMARY KEY,
       sha256 text NOT NULL,
       applied_at timestamptz NOT NULL DEFAULT now()
     )`,
  );

  for (const migration of migrations) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query<AppliedMigrationRow>(
        "SELECT sha256 FROM schema_migration WHERE name = $1",
        [migration.name],
      );
      const applied = existing.rows[0];
      if (applied !== undefined) {
        if (applied.sha256 !== migration.sha256) {
          throw new Error(`Migration ${migration.name} changed after it was applied`);
        }
        await client.query("COMMIT");
        continue;
      }
      await client.query(migration.sql);
      await client.query(
        "INSERT INTO schema_migration (name, sha256) VALUES ($1, $2)",
        [migration.name, migration.sha256],
      );
      await client.query("COMMIT");
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Preserve the migration failure.
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
