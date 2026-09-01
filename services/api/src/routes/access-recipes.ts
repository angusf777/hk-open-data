import {
  accessStatusSchema,
  adapterNameSchema,
  type GeneratedAccessRecipe,
} from "@hk-open-data/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AccessRegistry } from "../access-registry.js";
import { notFound } from "../errors.js";
import { pageQuery, pageResponse } from "./query.js";

const sourceReference = z.string().regex(/^HKAPI-[0-9]{3}$/);
const authenticationType = z.enum([
  "none",
  "api-key",
  "bearer",
  "basic",
  "oauth2",
  "registration",
]);
const accessRecipeQuery = pageQuery.extend({
  cursor: sourceReference.optional(),
  adapter: adapterNameSchema.optional(),
  status: accessStatusSchema.optional(),
  authentication: authenticationType.optional(),
  verification_freshness: z.enum(["current", "stale", "never"]).optional(),
});

export function registerAccessRecipeRoutes(
  app: FastifyInstance,
  registry: AccessRegistry,
): void {
  app.get("/v1/access-recipes", async (request) => {
    const query = accessRecipeQuery.parse(request.query);
    const result = registry.list({
      limit: query.limit,
      ...(query.adapter === undefined ? {} : { adapter: query.adapter }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.authentication === undefined ? {} : { authentication: query.authentication }),
      ...(query.verification_freshness === undefined
        ? {}
        : { verificationFreshness: query.verification_freshness }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
    });
    return pageResponse(result.items.map(accessRecipeResponse), result.nextCursor);
  });

  app.get("/v1/access-recipes/:source_reference", async (request) => {
    const params = z.object({ source_reference: sourceReference }).parse(request.params);
    const recipe = registry.get(params.source_reference);
    if (recipe === undefined) throw notFound("Access recipe");
    return accessRecipeResponse(recipe);
  });
}

export function accessRecipeResponse(recipe: GeneratedAccessRecipe) {
  return {
    schema_version: recipe.schemaVersion,
    source_reference: recipe.sourceReference,
    recipe_version: recipe.recipeVersion,
    adapter: recipe.adapter,
    status: recipe.status,
    effective_status: recipe.effectiveStatus,
    documentation_url: recipe.documentationUrl,
    limitations: recipe.limitations,
    authentication: {
      type: recipe.authentication.type,
      environment_variables: recipe.authentication.environmentVariables,
      setup: recipe.authentication.setup,
    },
    request:
      recipe.request === null
        ? null
        : {
            method: recipe.request.method,
            url_template: recipe.request.urlTemplate,
            allowed_hosts: recipe.request.allowedHosts,
            parameters: recipe.request.parameters.map((parameter) => ({
              name: parameter.name,
              location: parameter.location,
              data_type: parameter.dataType,
              required: parameter.required,
              default: parameter.default,
              example: parameter.example,
              description: parameter.description,
              enum: parameter.enum,
              minimum: parameter.minimum ?? null,
              maximum: parameter.maximum ?? null,
              pattern: parameter.pattern ?? null,
            })),
            headers: recipe.request.headers.map((header) => ({
              name: header.name,
              value: header.value,
              environment_variable: header.environmentVariable,
            })),
            body_template: recipe.request.bodyTemplate,
            timeout_ms: recipe.request.timeoutMs,
            max_response_bytes: recipe.request.maxResponseBytes,
            max_pages: recipe.request.maxPages,
            retry: {
              attempts: recipe.request.retry.attempts,
              status_codes: recipe.request.retry.statusCodes,
            },
          },
    response:
      recipe.response === null
        ? null
        : {
            media_types: recipe.response.mediaTypes,
            record_path: recipe.response.recordPath,
            id_path: recipe.response.idPath,
            timestamp_path: recipe.response.timestampPath,
            pagination: {
              strategy: recipe.response.pagination.strategy,
              next_path: recipe.response.pagination.nextPath,
            },
            normalization: recipe.response.normalization,
          },
    reason: recipe.reason,
    next_action: recipe.nextAction,
    recipe_sha256: recipe.recipeSha256,
    examples: recipe.examples,
    verification:
      recipe.verification === null
        ? null
        : {
            checked_at: recipe.verification.checkedAt,
            valid_until: recipe.verification.validUntil,
            outcome: recipe.verification.outcome,
            error_code: recipe.verification.errorCode,
            recipe_sha256: recipe.verification.recipeSha256,
            final_host: recipe.verification.finalHost,
            http_status: recipe.verification.httpStatus,
            elapsed_ms: recipe.verification.elapsedMs,
            media_type: recipe.verification.mediaType,
            response_bytes: recipe.verification.responseBytes,
            response_sha256: recipe.verification.responseSha256,
            schema_fingerprint: recipe.verification.schemaFingerprint,
            parsed_record_count: recipe.verification.parsedRecordCount,
            limitations: recipe.verification.limitations,
            tool_version: recipe.verification.toolVersion,
          },
  };
}
