import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readerFacingFiles = [
  "README.md",
  "README.zh-HK.md",
  "ROADMAP.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "RELEASE_EVIDENCE.md",
  "docs/architecture/OPEN_SOURCE_DESIGN.md",
  "docs/architecture/OVERVIEW.md",
  "docs/getting-started/runtime.md",
  "docs/getting-started/runtime.zh-HK.md",
  "docs/launch/LAUNCH_COPY.md",
  "docs/release/PRE_PUBLICATION_AUDIT.md",
  "docs/release/v0.1.0.md",
  "apps/catalog/src/i18n.ts",
  "apps/portal/src/App.tsx",
  "apps/portal/src/i18n/en.ts",
  "apps/portal/src/i18n/zh-Hant.ts",
  "apps/portal/src/features/developer/DeveloperPage.tsx",
  "apps/portal/src/features/methodology/MethodologyPage.tsx",
  "apps/portal/src/features/sources/PublicSourcesPage.tsx",
  "apps/admin/src/App.tsx",
  "apps/admin/src/features/targets/TargetsPage.tsx",
  "packages/ui/src/AppShell.tsx",
];

const internalWording =
  /\bP(?:0[1-9]|1[0-8])\b|fail-closed|provider traffic|resale service|digest-only|raw-evidence|operator-controlled|\bupstream\b|上游/i;

test("reader-facing copy avoids internal portfolio codes and governance shorthand", async () => {
  for (const file of readerFacingFiles) {
    const text = await readFile(file, "utf8");
    assert.doesNotMatch(text, internalWording, `${file} contains internal-facing wording`);
  }
});

test("published catalogue tags use understandable topics instead of portfolio codes", async () => {
  for (const collection of ["official", "external", "mcp"]) {
    const catalogue = await readFile(`catalog/generated/${collection}.json`, "utf8");
    assert.doesNotMatch(catalogue, /"P(?:0[1-9]|1[0-8])"/);
    assert.doesNotMatch(catalogue, /\bupstream\b|上游/i);
  }
});
