import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";

import type { PlatformReadClient } from "./client.js";
import { PINNED_TOOL_FINGERPRINT, toolFingerprint } from "./fingerprint.js";
import { createMcpServer, NORMATIVE_TOOL_NAMES } from "./server.js";

const platform: PlatformReadClient = {
  async call() {
    throw new Error("not called");
  },
};

describe("normative MCP tool contract", () => {
  it("matches the documented names and pinned schema fingerprint", async () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const contract = readFileSync(
      resolve(root, "packages/schemas/contracts/mcp-tool-contract.md"),
      "utf8",
    );
    const documented = [...contract.matchAll(/^### `([^`]+)`$/gm)].map((match) => match[1]!);
    const server = createMcpServer(platform);
    const client = new Client({ name: "fingerprint", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    const tools = (await client.listTools()).tools;

    expect(NORMATIVE_TOOL_NAMES).toEqual([
      "sources_list",
      "source_get",
      "source_records_query",
      "source_record_get",
      "events_query",
      "event_get",
      "monitor_targets_list",
      "monitor_target_get",
      "incidents_list",
      "incident_get",
      "status_summary",
      "access_recipes_list",
      "access_recipe_get",
    ]);
    expect(documented).toEqual(NORMATIVE_TOOL_NAMES);
    expect(toolFingerprint(tools)).toBe(PINNED_TOOL_FINGERPRINT);
    expect(tools.every((tool) => tool.inputSchema.additionalProperties === false)).toBe(true);
    await client.close();
    await server.close();
  });
});
