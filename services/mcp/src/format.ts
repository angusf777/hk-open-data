import type { CallToolResult } from "@modelcontextprotocol/server";

import type { ToolEnvelope } from "./client.js";

export const MAX_TOOL_RESPONSE_CHARACTERS = 25_000;
const TEXT_PREFIX = "Read-only evidence result\n\n```json\n";
const TEXT_SUFFIX = "\n```";

export function formatToolResult(envelope: ToolEnvelope): CallToolResult {
  const json = JSON.stringify(envelope);
  if (TEXT_PREFIX.length + json.length + TEXT_SUFFIX.length > MAX_TOOL_RESPONSE_CHARACTERS) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: JSON.stringify({
            code: "RESPONSE_TOO_LARGE",
            message: "Reduce the query limit or narrow the filters",
            retryable: true,
            correlation_id: "local",
          }),
        },
      ],
    };
  }
  return {
    content: [{ type: "text", text: `${TEXT_PREFIX}${json}${TEXT_SUFFIX}` }],
    structuredContent: envelope,
  };
}
