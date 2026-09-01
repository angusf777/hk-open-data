import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { describe, expect, it } from "vitest";

import type { PlatformReadClient } from "./client.js";
import { createMcpServer } from "./server.js";

interface Evaluation {
  id: string;
  question: string;
  calls: Array<{ tool: string; arguments: Record<string, unknown> }>;
  expectedTools: string[];
}

function evaluations(): Evaluation[] {
  const path = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../evaluations/read-only.xml",
  );
  const xml = readFileSync(path, "utf8");
  return [...xml.matchAll(/<evaluation id="([^"]+)">([\s\S]*?)<\/evaluation>/g)].map(
    (match) => {
      const body = match[2]!;
      const question = /<question>([\s\S]*?)<\/question>/.exec(body)?.[1]?.trim() ?? "";
      const calls = [...body.matchAll(/<call tool="([^"]+)">([\s\S]*?)<\/call>/g)].map(
        (call) => ({ tool: call[1]!, arguments: JSON.parse(call[2]!.trim()) as Record<string, unknown> }),
      );
      const expectedTools =
        /<expected_tools>([^<]+)<\/expected_tools>/.exec(body)?.[1]?.split(",") ?? [];
      return { id: match[1]!, question, calls, expectedTools };
    },
  );
}

describe("read-only MCP evaluations", () => {
  it("contains twelve unique stable questions whose expected answers resolve through tools", async () => {
    const fixtures = evaluations();
    expect(fixtures).toHaveLength(12);
    expect(new Set(fixtures.map((fixture) => fixture.id)).size).toBe(12);
    expect(new Set(fixtures.map((fixture) => fixture.question)).size).toBe(12);
    const platform: PlatformReadClient = {
      async call(name, input) {
        return {
          contract_version: "2026-09-01.v1",
          data: { tool: name, input },
          evidence: {
            source_record_ids: ["SR-EVAL0001"],
            retrieved_at: "2026-08-28T10:00:00.000Z",
            freshness_status: "fresh",
            limitations: [],
          },
          next_cursor: null,
        };
      },
    };
    const server = createMcpServer(platform);
    const client = new Client({ name: "evaluation", version: "1" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

    for (const fixture of fixtures) {
      const resolved: string[] = [];
      for (const call of fixture.calls) {
        const result = await client.callTool({ name: call.tool, arguments: call.arguments });
        expect(result.isError, fixture.id).not.toBe(true);
        const structured = result.structuredContent as { data?: { tool?: string } } | undefined;
        resolved.push(structured?.data?.tool ?? "");
      }
      expect(resolved, fixture.id).toEqual(fixture.expectedTools);
    }
    await client.close();
    await server.close();
  });
});
