import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("catalogue container includes every static-build input", async () => {
  const dockerfile = await readFile("infra/docker/catalog.Dockerfile", "utf8");
  for (const instruction of [
    "COPY access/generated access/generated",
    "COPY access/verification/data-gov-resources/manifest.json access/verification/data-gov-resources/manifest.json",
    "COPY packages/schemas/contracts packages/schemas/contracts",
    "COPY scripts/export_snapshots.py scripts/export_snapshots.py",
    "COPY llms.txt llms.txt",
  ]) {
    assert.match(dockerfile, new RegExp(`^${instruction}$`, "m"));
  }
});
