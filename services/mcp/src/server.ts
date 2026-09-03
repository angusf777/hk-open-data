import {
  McpServer,
  type CallToolResult,
  type StandardSchemaWithJSON,
} from "@modelcontextprotocol/server";

import type { PlatformReadClient } from "./client.js";
import { safeToolError } from "./errors.js";
import { formatToolResult } from "./format.js";
import { outputSchema } from "./schemas.js";
import { accessRecipeToolSchemas } from "./tools/access-recipes.js";
import { eventToolSchemas } from "./tools/events.js";
import { qualityToolSchemas } from "./tools/quality.js";
import { sourceToolSchemas } from "./tools/sources.js";

export const NORMATIVE_TOOL_NAMES = [
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
  "access_resources_list",
  "access_resource_get",
] as const;

const descriptions: Record<(typeof NORMATIVE_TOOL_NAMES)[number], string> = {
  sources_list: "List approved source summaries visible to the caller.",
  source_get: "Get one approved source definition and current health.",
  source_records_query: "Query bounded normalized source-record summaries with evidence.",
  source_record_get: "Get one normalized source record and provenance identifiers, never raw bytes.",
  events_query: "Query canonical events with evidence and explicit expiry.",
  event_get: "Get one canonical event and its approved evidence.",
  monitor_targets_list: "List visible monitor targets and their current outcomes.",
  monitor_target_get: "Get one monitor target with bounded observation history.",
  incidents_list: "List reviewed incidents visible to the caller.",
  incident_get: "Get one visible incident and reviewed evidence timeline.",
  status_summary: "Return aggregate read-only platform status.",
  access_recipes_list: "List bounded technical access recipes without contacting providers.",
  access_recipe_get: "Get one technical access recipe and its generated code examples.",
  access_resources_list:
    "List current provider resource URLs and required parameters for one catalogue source.",
  access_resource_get:
    "Get one provider resource URL template, access classification, and local usage commands.",
};

const annotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function registerReadTool(
  server: McpServer,
  platform: PlatformReadClient,
  name: (typeof NORMATIVE_TOOL_NAMES)[number],
  inputSchema: StandardSchemaWithJSON,
): void {
  server.registerTool(
    name,
    {
      description: descriptions[name],
      inputSchema,
      outputSchema,
      annotations,
    },
    async (input): Promise<CallToolResult> => {
      try {
        const normalized =
          typeof input === "object" && input !== null ? { ...input } : {};
        return formatToolResult(await platform.call(name, normalized));
      } catch (error) {
        return safeToolError(error);
      }
    },
  );
}

export function createMcpServer(platform: PlatformReadClient): McpServer {
  const server = new McpServer({ name: "hk-open-data-readonly", version: "0.1.0" });
  registerReadTool(server, platform, "sources_list", sourceToolSchemas.sources_list);
  registerReadTool(server, platform, "source_get", sourceToolSchemas.source_get);
  registerReadTool(server, platform, "source_records_query", sourceToolSchemas.source_records_query);
  registerReadTool(server, platform, "source_record_get", sourceToolSchemas.source_record_get);
  registerReadTool(server, platform, "events_query", eventToolSchemas.events_query);
  registerReadTool(server, platform, "event_get", eventToolSchemas.event_get);
  registerReadTool(server, platform, "monitor_targets_list", qualityToolSchemas.monitor_targets_list);
  registerReadTool(server, platform, "monitor_target_get", qualityToolSchemas.monitor_target_get);
  registerReadTool(server, platform, "incidents_list", qualityToolSchemas.incidents_list);
  registerReadTool(server, platform, "incident_get", qualityToolSchemas.incident_get);
  registerReadTool(server, platform, "status_summary", qualityToolSchemas.status_summary);
  registerReadTool(
    server,
    platform,
    "access_recipes_list",
    accessRecipeToolSchemas.access_recipes_list,
  );
  registerReadTool(
    server,
    platform,
    "access_recipe_get",
    accessRecipeToolSchemas.access_recipe_get,
  );
  registerReadTool(
    server,
    platform,
    "access_resources_list",
    accessRecipeToolSchemas.access_resources_list,
  );
  registerReadTool(
    server,
    platform,
    "access_resource_get",
    accessRecipeToolSchemas.access_resource_get,
  );
  return server;
}
