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
const resourceInventory = JSON.parse(
  await readFile("access/generated/data-gov-resources.json", "utf8"),
);
const expected = generated.recipes.find((recipe) => recipe.sourceReference === "HKAPI-001");
if (expected === undefined) throw new Error("HKAPI-001 is missing from generated recipes");
const expectedResource = resourceInventory.resources.find((resource) =>
  resource.sourceReferences.includes("HKAPI-030"),
);
if (expectedResource === undefined) throw new Error("HKAPI-030 has no mapped provider resource");

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

const resourceApiResponse = await fetch(
  `${apiBase}/access-resources/${encodeURIComponent(expectedResource.datasetId)}/${encodeURIComponent(expectedResource.resourceId)}`,
  { signal: AbortSignal.timeout(5_000) },
);
if (!resourceApiResponse.ok) {
  throw new Error(`provider resource API returned ${resourceApiResponse.status}`);
}
const apiResource = await resourceApiResponse.json();
if (
  apiResource.resource_id !== expectedResource.resourceId ||
  apiResource.url_template !== expectedResource.urlTemplate
) {
  throw new Error("provider resource API projection does not match generated data");
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
  const resourceList = await client.callTool({
    name: "access_resources_list",
    arguments: { source_reference: "HKAPI-030", limit: 1 },
  });
  const resourceDetail = await client.callTool({
    name: "access_resource_get",
    arguments: {
      dataset_id: expectedResource.datasetId,
      resource_id: expectedResource.resourceId,
    },
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
  const resourceListItems = resourceList.structuredContent?.data?.items;
  const resourceDetailItem = resourceDetail.structuredContent?.data?.item;
  if (!Array.isArray(resourceListItems) || resourceListItems.length !== 1) {
    throw new Error("access_resources_list did not return one bounded item");
  }
  if (
    resourceDetailItem?.resource_id !== expectedResource.resourceId ||
    resourceDetailItem?.url_template !== expectedResource.urlTemplate
  ) {
    throw new Error("access_resource_get projection does not match generated data");
  }
} finally {
  await client.close();
}

console.log(
  `local smoke passed (${endpoints.length + 2} HTTP endpoints, 4 read-only access MCP tools)`,
);
