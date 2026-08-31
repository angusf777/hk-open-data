import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
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
