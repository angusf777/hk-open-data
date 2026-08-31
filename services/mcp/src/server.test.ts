import {
  Client,
  InMemoryTransport,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";

import type { PlatformReadClient } from "./client.js";
import { createMcpServer, NORMATIVE_TOOL_NAMES } from "./server.js";

const calls: Array<{ name: string; input: Record<string, unknown> }> = [];
const readClient: PlatformReadClient = {
  async call(name, input) {
    calls.push({ name, input });
    return {
      contract_version: "2026-08-28.v1",
      data: { name, input, source_record_ids: ["SR-00000001"] },
      evidence: {
        source_record_ids: ["SR-00000001"],
        retrieved_at: "2026-08-28T10:00:00.000Z",
        freshness_status: "fresh",
        limitations: [],
      },
      next_cursor: input["cursor"] === undefined ? "next-opaque" : null,
    };
  },
};

let closeCurrent: (() => Promise<void>) | undefined;

async function connectedClient(): Promise<Client> {
  calls.length = 0;
  const server = createMcpServer(readClient);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  closeCurrent = async () => {
    await client.close();
    await server.close();
  };
  return client;
}

afterEach(async () => closeCurrent?.());

describe("first-party read-only MCP server", () => {
  it("exposes exactly the eleven normative tools with read-only annotations", async () => {
    const client = await connectedClient();
    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name)).toEqual(NORMATIVE_TOOL_NAMES);
    expect(result.tools.every((tool) => tool.annotations?.readOnlyHint === true)).toBe(true);
  });

  it("passes bounded pagination input and returns structured evidence", async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: "sources_list",
      arguments: { project: "P01", cursor: "opaque", limit: 25 },
    });

    expect(calls).toEqual([
      { name: "sources_list", input: { project: "P01", cursor: "opaque", limit: 25 } },
    ]);
    expect(result.structuredContent).toMatchObject({
      contract_version: "2026-08-28.v1",
      evidence: { source_record_ids: ["SR-00000001"] },
      next_cursor: null,
    });
  });

  it("supports detail and anonymous status tools", async () => {
    const client = await connectedClient();
    const detail = await client.callTool({
      name: "source_record_get",
      arguments: { source_record_id: "SR-00000001" },
    });
    const status = await client.callTool({ name: "status_summary", arguments: {} });

    expect(detail.isError).not.toBe(true);
    expect(status.isError).not.toBe(true);
    expect(calls.map((call) => call.name)).toEqual(["source_record_get", "status_summary"]);
  });

  it("serves a stateless modern Streamable HTTP request in process", async () => {
    const handler = createMcpHandler(() => createMcpServer(readClient));
    const client = new Client({ name: "http-test", version: "1" });
    const transport = new StreamableHTTPClientTransport(new URL("http://test.local/mcp"), {
      fetch: (url, init) => handler.fetch(new Request(url, init)),
    });
    await client.connect(transport);

    expect((await client.listTools()).tools).toHaveLength(11);
    const result = await client.callTool({ name: "status_summary", arguments: {} });
    expect(result.isError).not.toBe(true);
    await client.close();
    await handler.close();
  });
});
