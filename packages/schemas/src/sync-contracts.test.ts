import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

describe("contract synchronization", () => {
  it("copies the eight public contracts and writes verified hashes", () => {
    const output = mkdtempSync(resolve(tmpdir(), "hk-data-contracts-"));
    temporaryDirectories.push(output);

    execFileSync(
      process.execPath,
      ["scripts/sync-contracts.mjs", "--out", output],
      { cwd: packageRoot },
    );

    const manifest = JSON.parse(
      readFileSync(resolve(output, "contract-manifest.json"), "utf8"),
    ) as { contract_version: string; files: Record<string, string> };

    expect(manifest.contract_version).toBe("2026-08-28.v1");
    expect(Object.keys(manifest.files).sort()).toEqual([
      "canonical_event.schema.json",
      "connector_run.schema.json",
      "incident.schema.json",
      "mcp_allowlist.schema.json",
      "monitor_observation.schema.json",
      "openapi.json",
      "operating-profile.schema.json",
      "source_record.schema.json",
    ]);

    for (const [name, expectedHash] of Object.entries(manifest.files)) {
      const body = readFileSync(resolve(output, name));
      expect(createHash("sha256").update(body).digest("hex"), name).toBe(expectedHash);
    }
  });
});
