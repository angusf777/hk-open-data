import { serveStdio } from "@modelcontextprotocol/server/stdio";

import { RestPlatformClient } from "./client.js";
import { createMcpServer } from "./server.js";

const baseUrl = process.env["PLATFORM_API_URL"];
if (baseUrl === undefined) {
  throw new Error("PLATFORM_API_URL is required");
}

const handle = serveStdio(() =>
  createMcpServer(
    new RestPlatformClient({
      baseUrl,
      ...(process.env["PLATFORM_API_TOKEN"] === undefined
        ? {}
        : { token: process.env["PLATFORM_API_TOKEN"] }),
    }),
  ),
);

process.on("SIGINT", () => void handle.close());
console.error("HK public-data read-only MCP is serving stdio");
