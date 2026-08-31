import { createServer } from "node:http";

import {
  hostHeaderValidation,
  localhostHostValidation,
  localhostOriginValidation,
  originValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";

import { RestPlatformClient } from "./client.js";
import { callerToken } from "./http-auth.js";
import { createMcpServer } from "./server.js";

const baseUrl = process.env["PLATFORM_API_URL"];
if (baseUrl === undefined) {
  throw new Error("PLATFORM_API_URL is required");
}
const host = process.env["MCP_HOST"] ?? "127.0.0.1";
const port = Number(process.env["MCP_PORT"] ?? "3100");
const factory = (context: { requestInfo?: Request }) => {
  const token = callerToken(context.requestInfo?.headers.get("authorization") ?? null);
  return createMcpServer(
    new RestPlatformClient({
      baseUrl,
      ...(token === undefined ? {} : { token }),
      allowInternalHttp: process.env["MCP_ALLOW_INTERNAL_HTTP"] === "true",
    }),
  );
};
const handler = toNodeHandler(createMcpHandler(factory));
const allowedHosts = process.env["MCP_ALLOWED_HOSTS"]?.split(",").map((value) => value.trim()).filter(Boolean);
const allowedOrigins = process.env["MCP_ALLOWED_ORIGINS"]?.split(",").map((value) => value.trim()).filter(Boolean);
const validateHost = allowedHosts === undefined || allowedHosts.length === 0
  ? localhostHostValidation()
  : hostHeaderValidation(allowedHosts);
const validateOrigin = allowedOrigins === undefined || allowedOrigins.length === 0
  ? localhostOriginValidation()
  : originValidation(allowedOrigins);

createServer((request, response) => {
  if (request.url === "/healthz") {
    response.writeHead(200, { "content-type": "application/json" }).end('{"status":"live"}');
    return;
  }
  if (request.url !== "/mcp") {
    response.writeHead(404).end();
    return;
  }
  if (!validateHost(request, response) || !validateOrigin(request, response)) {
    return;
  }
  if (request.method === undefined) {
    response.writeHead(400).end();
    return;
  }
  void handler(request as typeof request & { method: string; url: string }, response);
}).listen(port, host, () => console.error(`MCP listening on http://${host}:${port}/mcp`));
