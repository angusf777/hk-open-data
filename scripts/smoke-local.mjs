import { readFile } from "node:fs/promises";

import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";

const apiBase = process.env.API_BASE_URL ?? "http://127.0.0.1:3000/v1";
const mcpUrl = process.env.MCP_URL ?? "http://127.0.0.1:3100/mcp";
const endpoints = [
  `${apiBase.replace(/\/v1$/, "")}/health/ready`,
  `${apiBase}/status/summary`,
  `${mcpUrl.replace(/\/mcp$/, "")}/healthz`,
  "http://127.0.0.1:8080/healthz",
  "http://127.0.0.1:8081/healthz",
];

for (const endpoint of endpoints) {
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(5_000) });
  if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
}

const generated = JSON.parse(await readFile("access/generated/recipes.json", "utf8"));
const expected = generated.recipes.find((recipe) => recipe.sourceReference === "HKAPI-001");
if (expected === undefined) throw new Error("HKAPI-001 is missing from generated recipes");

const apiResponse = await fetch(`${apiBase}/access-recipes/HKAPI-001`, {
  signal: AbortSignal.timeout(5_000),
});
if (!apiResponse.ok) throw new Error(`access recipe API returned ${apiResponse.status}`);
const apiRecipe = await apiResponse.json();
if (
  apiRecipe.source_reference !== expected.sourceReference ||
  apiRecipe.recipe_sha256 !== expected.recipeSha256 ||
  apiRecipe.effective_status !== expected.effectiveStatus
) {
  throw new Error("access recipe API projection does not match generated data");
}

const client = new Client({ name: "hk-open-data-local-smoke", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL(mcpUrl));
await client.connect(transport);
try {
  const list = await client.callTool({
    name: "access_recipes_list",
    arguments: { status: expected.effectiveStatus, limit: 1 },
  });
  const detail = await client.callTool({
    name: "access_recipe_get",
    arguments: { source_reference: "HKAPI-001" },
  });
  const listItems = list.structuredContent?.data?.items;
  const detailItem = detail.structuredContent?.data?.item;
  if (!Array.isArray(listItems) || listItems.length !== 1) {
    throw new Error("access_recipes_list did not return one bounded item");
  }
  if (
    detailItem?.source_reference !== expected.sourceReference ||
    detailItem?.recipe_sha256 !== expected.recipeSha256 ||
    detailItem?.effective_status !== expected.effectiveStatus
  ) {
    throw new Error("access_recipe_get projection does not match generated data");
  }
} finally {
  await client.close();
}

console.log(
  `local smoke passed (${endpoints.length + 1} HTTP endpoints, 2 read-only MCP tools)`,
);
