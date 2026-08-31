import type { CallToolResult } from "@modelcontextprotocol/server";

import { PlatformClientError } from "./client.js";

export function safeToolError(error: unknown): CallToolResult {
  const envelope =
    error instanceof PlatformClientError
      ? {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
          correlation_id: error.correlationId,
        }
      : {
          code: "TOOL_EXECUTION_FAILED",
          message: "The read request could not be completed",
          retryable: false,
          correlation_id: "local",
        };
  return { isError: true, content: [{ type: "text", text: JSON.stringify(envelope) }] };
}
