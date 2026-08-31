import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("static catalogue build", () => {
  it("creates a permanent detail page for every validated resource", () => {
    const appRoot = resolve(import.meta.dirname, "..");
    execFileSync("node", ["scripts/build-static.mjs"], { cwd: appRoot, stdio: "pipe" });

    const detail = readFileSync(
      resolve(appRoot, "dist/resources/official%3Ahkapi-001/index.html"),
      "utf8",
    );
    expect(detail).toContain(
      '<link rel="canonical" href="https://angusf777.github.io/hk-open-data/resources/official%3Ahkapi-001/" />',
    );
    expect(detail).toContain('window.__HK_OPEN_DATA_RESOURCE_ID__="official:hkapi-001"');
  });
});
