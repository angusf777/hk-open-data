import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { scanPublicBoundary } from "../../scripts/check-public-boundary.mjs";

test("clean repository excludes private and generated developer state", async () => {
  const findings = await scanPublicBoundary(process.cwd());
  assert.deepEqual(findings, []);
});

test("scanner reports excluded state, private paths, and secret patterns", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "hk-open-data-boundary-"));
  try {
    await mkdir(path.join(root, "node_modules"));
    await writeFile(path.join(root, "notes.md"), "/" + "Users/example/private\n", "utf8");
    await writeFile(
      path.join(root, "secret.yml"),
      "token: gh" + "p_abcdefghijklmnopqrstuvwxyz123456\n",
      "utf8",
    );

    assert.deepEqual(await scanPublicBoundary(root), [
      "node_modules",
      "notes.md:private-path",
      "secret.yml:secret-pattern",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("published source verification files contain approved metadata only", async () => {
  const root = "access/verification";
  const allowed = new Set([
    "checkedAt",
    "elapsedMs",
    "errorCode",
    "finalHost",
    "httpStatus",
    "limitations",
    "mediaType",
    "outcome",
    "parsedRecordCount",
    "recipeSha256",
    "recipeVersion",
    "responseBytes",
    "responseSha256",
    "schemaFingerprint",
    "schemaVersion",
    "sourceReference",
    "toolVersion",
    "validUntil",
  ]);
  const files = (await readdir(root)).filter((name) => name.endsWith(".json"));
  assert.equal(files.length, 227);
  for (const file of files) {
    const value = JSON.parse(await readFile(path.join(root, file), "utf8"));
    assert.deepEqual(
      Object.keys(value).sort(),
      [...allowed].sort(),
      `${file} contains an unexpected evidence field`,
    );
    assert.equal(typeof value.finalHost, "string");
    assert.ok(["success", "failure"].includes(value.outcome));
  }
});
