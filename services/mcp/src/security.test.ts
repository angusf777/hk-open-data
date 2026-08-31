import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";

import type { PlatformReadClient } from "./client.js";
import { createMcpServer } from "./server.js";

const clientImpl: PlatformReadClient = {
  async call() {
    return {
      contract_version: "2026-08-28.v1",
      data: { content: "x".repeat(30_000) },
      evidence: {
        source_record_ids: [],
        retrieved_at: "2026-08-28T10:00:00.000Z",
        freshness_status: "unknown",
        limitations: [],
      },
      next_cursor: null,
    };
  },
};

describe("MCP security boundary", () => {
  it("has no write, arbitrary URL, raw payload, SQL, shell or browser tools", async () => {
    const server = createMcpServer(clientImpl);
    const client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    const names = (await client.listTools()).tools.map((tool) => tool.name).join(" ");

    expect(names).not.toMatch(/approve|resolve|suppress|url|raw|sql|shell|browser|create|delete/);
    await client.close();
    await server.close();
  });

  it("rejects unrecognized arbitrary-url inputs before the client is called", async () => {
    const server = createMcpServer(clientImpl);
    const client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    const result = await client.callTool({
      name: "status_summary",
      arguments: { url: "https://attacker.example" },
    });

    expect(result.isError).toBe(true);
    await client.close();
    await server.close();
  });

  it("returns a safe error instead of an oversized response", async () => {
    const server = createMcpServer(clientImpl);
    const client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    const result = await client.callTool({ name: "status_summary", arguments: {} });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result)).toContain("RESPONSE_TOO_LARGE");
    expect(JSON.stringify(result).length).toBeLessThan(25_000);
    await client.close();
    await server.close();
  });

  it("caps the complete rendered text, including its Markdown wrapper", async () => {
    const boundaryClient: PlatformReadClient = {
      async call() {
        return {
          contract_version: "2026-08-28.v1",
          data: { content: "x".repeat(24_000) },
          evidence: {
            source_record_ids: [],
            retrieved_at: "2026-08-28T10:00:00.000Z",
            freshness_status: "unknown",
            limitations: [],
          },
          next_cursor: null,
        };
      },
    };
    const server = createMcpServer(boundaryClient);
    const client = new Client({ name: "test", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
    const result = await client.callTool({ name: "status_summary", arguments: {} });

    expect(result.isError).not.toBe(true);
    expect(result.content[0]?.type).toBe("text");
    if (result.content[0]?.type === "text") {
      expect(result.content[0].text.length).toBeLessThanOrEqual(25_000);
    }
    await client.close();
    await server.close();
  });
});
