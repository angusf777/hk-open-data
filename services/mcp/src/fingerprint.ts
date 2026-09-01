import { createHash } from "node:crypto";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonical);
  }
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonical(item)]),
    );
  }
  return value;
}

export function toolFingerprint(
  tools: Array<{ name: string; inputSchema: Record<string, unknown> }>,
): string {
  const contract = tools.map((tool) => ({ name: tool.name, inputSchema: canonical(tool.inputSchema) }));
  return createHash("sha256").update(JSON.stringify(contract)).digest("hex");
}

export const PINNED_TOOL_FINGERPRINT = "121902f4392514a80635f691ad41a78b9235753baf18e11033f052d0759e2317";
