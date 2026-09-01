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
  "docs/getting-started/access-recipes.md",
  "docs/getting-started/access-recipes.zh-HK.md",
  "packages/connectors/README.md",
  "packages/sdk-python/README.md",
  "packages/sdk-typescript/README.md",
  "services/api/README.md",
  "services/mcp/README.md",
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

test("bilingual guides explain source access with copyable commands and evidence limits", async () => {
  const english = await readFile("README.md", "utf8");
  const chinese = await readFile("README.zh-HK.md", "utf8");
  const guide = await readFile("docs/getting-started/access-recipes.md", "utf8");
  const chineseGuide = await readFile(
    "docs/getting-started/access-recipes.zh-HK.md",
    "utf8",
  );

  for (const text of [english, chinese, guide, chineseGuide]) {
    assert.match(text, /hkdata recipe HKAPI-001/);
    assert.match(text, /hkdata example HKAPI-001 python/);
    assert.match(text, /hkdata verify HKAPI-001/);
  }
  assert.match(english, /265 official sources/i);
  assert.match(english, /227 executable recipes/i);
  assert.match(english, /219 recipes currently have matching live evidence/is);
  assert.match(english, /does not grant.*commercial use.*caching.*redistribution/is);
  assert.match(guide, /--allow-unverified/);
  assert.match(guide, /GET \/v1\/access-recipes/);
  assert.match(guide, /access_recipes_list/);
  assert.match(guide, /access_recipe_get/);
  assert.match(chinese, /265 項官方來源/);
  assert.match(chinese, /227 項可執行配方/);
});

test("SDK and service guides document the access recipe surfaces", async () => {
  const python = await readFile("packages/sdk-python/README.md", "utf8");
  const typescript = await readFile("packages/sdk-typescript/README.md", "utf8");
  const api = await readFile("services/api/README.md", "utf8");
  const mcp = await readFile("services/mcp/README.md", "utf8");

  assert.match(python, /list_access_recipes/);
  assert.match(python, /get_access_recipe/);
  assert.match(python, /get_access_example/);
  assert.match(typescript, /listAccessRecipes/);
  assert.match(typescript, /getAccessRecipe/);
  assert.match(typescript, /getAccessExample/);
  assert.match(api, /GET `?\/v1\/access-recipes`?/);
  assert.match(api, /GET `?\/v1\/access-recipes\/\{source_reference\}`?/);
  assert.match(mcp, /access_recipes_list/);
  assert.match(mcp, /access_recipe_get/);
  assert.match(mcp, /does not execute/i);
});
