import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DataType, newDb } from "pg-mem";
import { describe, expect, it } from "vitest";

import { buildSeedData } from "./seed-data.js";
import { seedDatabase } from "./seed.js";

const migrationPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../migrations/001_platform.sql",
);
const cataloguePath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../catalog/generated/catalogue.json",
);

describe("buildSeedData", () => {
  it("builds pending private definitions for every P01/P14 source without inventing approval", () => {
    const seed = buildSeedData("2026-08-28T10:00:00.000Z");

    expect(seed.sourceGroups).toHaveLength(10);
    expect(seed.sources).toHaveLength(22);
    expect(seed.monitorTargets).toHaveLength(50);
    expect(seed.sources.every((source) => source.approvalStatus === "specified_pending_approval"))
      .toBe(true);
    expect(seed.sources.every((source) => source.visibility === "private")).toBe(true);
    expect(seed.sources.map((source) => source.sourceId)).toContain("HKAPI-034");
    expect(seed.sources.every((source) => source.catalogueId?.startsWith("official:"))).toBe(true);
    expect(seed.sources.every((source) => source.termsEvidenceState !== undefined)).toBe(true);
  });

  it("rejects a registry source absent from the public catalogue", () => {
    const catalogue = JSON.parse(readFileSync(cataloguePath, "utf8")) as {
      resources: Array<{ sourceReference: string }>;
    };
    catalogue.resources = catalogue.resources.filter(
      (resource) => resource.sourceReference !== "HKAPI-034",
    );
    const directory = mkdtempSync(resolve(tmpdir(), "hk-open-data-catalogue-"));
    const invalidCataloguePath = resolve(directory, "catalogue.json");
    writeFileSync(invalidCataloguePath, JSON.stringify(catalogue));

    expect(() =>
      buildSeedData("2026-08-28T10:00:00.000Z", {
        cataloguePath: invalidCataloguePath,
      }),
    ).toThrow("Public catalogue does not contain source reference HKAPI-034");
  });

  it("seeds groups, sources and monitor targets idempotently", async () => {
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
    const seed = buildSeedData("2026-08-28T10:00:00.000Z");

    await seedDatabase(pool, seed);
    await seedDatabase(pool, seed);

    expect(Number((await pool.query("SELECT count(*)::int AS count FROM source_group")).rows[0]?.count)).toBe(10);
    expect(Number((await pool.query("SELECT count(*)::int AS count FROM source_definition")).rows[0]?.count)).toBe(22);
    expect(Number((await pool.query("SELECT count(*)::int AS count FROM monitor_target")).rows[0]?.count)).toBe(50);
    expect(
      Number((await pool.query("SELECT count(*)::int AS count FROM source_definition WHERE approval_status <> 'specified_pending_approval'")).rows[0]?.count),
    ).toBe(0);
    await pool.end();
  });
});
