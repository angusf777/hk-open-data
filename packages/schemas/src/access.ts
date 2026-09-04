import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

export const accessStatusSchema = z.enum([
  "live-verified",
  "fixture-tested",
  "credential-required",
  "manual-only",
  "blocked",
  "unavailable",
]);

export const adapterNameSchema = z.enum([
  "none",
  "ckan-action",
  "data-gov-resource-index",
  "rest-json",
  "odata",
  "arcgis-rest",
  "ogc-wfs",
  "ogc-wms",
  "xml",
  "csv",
  "rss",
  "file-download",
]);

const environmentVariableSchema = z.string().regex(/^[A-Z][A-Z0-9_]{2,127}$/);
const scalarSchema = z.union([z.string(), z.number(), z.boolean()]);

const authenticationSchema = z
  .object({
    type: z.enum(["none", "api-key", "bearer", "basic", "oauth2", "registration"]),
    environmentVariables: z.array(environmentVariableSchema),
    setup: z.string().min(1).nullable(),
  })
  .strict();

const parameterSchema = z
  .object({
    name: z.string().min(1),
    location: z.enum(["path", "query", "header", "body"]),
    dataType: z.enum(["string", "integer", "number", "boolean", "date", "datetime"]),
    required: z.boolean(),
    default: scalarSchema.nullable(),
    example: scalarSchema.nullable(),
    description: z.string().min(1),
    enum: z.array(scalarSchema),
    minimum: z.number().nullable().optional(),
    maximum: z.number().nullable().optional(),
    pattern: z.string().min(1).nullable().optional(),
  })
  .strict()
  .superRefine((parameter, context) => {
    if (
      (parameter.minimum !== undefined && parameter.minimum !== null) ||
      (parameter.maximum !== undefined && parameter.maximum !== null)
    ) {
      if (!['integer', 'number'].includes(parameter.dataType)) {
        context.addIssue({ code: 'custom', message: 'numeric bounds require a numeric parameter' });
      }
    }
    if (
      parameter.minimum !== undefined &&
      parameter.minimum !== null &&
      parameter.maximum !== undefined &&
      parameter.maximum !== null &&
      parameter.minimum > parameter.maximum
    ) {
      context.addIssue({ code: 'custom', message: 'parameter minimum cannot exceed maximum' });
    }
    if (parameter.pattern !== undefined && parameter.pattern !== null && parameter.dataType !== 'string') {
      context.addIssue({ code: 'custom', message: 'pattern requires a string parameter' });
    }
  });

const headerSchema = z
  .object({
    name: z.string().min(1),
    value: z.string().min(1).nullable(),
    environmentVariable: environmentVariableSchema.nullable(),
  })
  .strict()
  .superRefine((header, context) => {
    if ((header.value === null) === (header.environmentVariable === null)) {
      context.addIssue({ code: "custom", message: "header requires exactly one value source" });
    }
    if (
      ["authorization", "cookie", "proxy-authorization"].includes(header.name.toLowerCase()) &&
      header.value !== null
    ) {
      context.addIssue({ code: "custom", message: "credential values are forbidden in recipes" });
    }
  });

const requestSchema = z
  .object({
    method: z.enum(["GET", "POST", "HEAD"]),
    urlTemplate: z.url().startsWith("https://"),
    allowedHosts: z.array(z.string().regex(/^[A-Za-z0-9.-]+$/)).min(1),
    parameters: z.array(parameterSchema),
    headers: z.array(headerSchema),
    bodyTemplate: z.union([z.record(z.string(), z.unknown()), z.string()]).nullable(),
    timeoutMs: z.number().int().min(1_000).max(60_000),
    maxResponseBytes: z.number().int().positive().max(25 * 1024 * 1024),
    maxPages: z.number().int().min(1).max(100),
    retry: z
      .object({
        attempts: z.number().int().min(1).max(3),
        statusCodes: z.array(z.number().int().min(100).max(599)),
      })
      .strict(),
  })
  .strict()
  .superRefine((request, context) => {
    const host = new URL(request.urlTemplate).hostname.toLowerCase().replace(/\.$/, "");
    const allowed = request.allowedHosts.map((value) => value.toLowerCase().replace(/\.$/, ""));
    if (!allowed.includes(host)) {
      context.addIssue({ code: "custom", message: "initial request host must be allowlisted" });
    }
  });

const responseSchema = z
  .object({
    mediaTypes: z.array(z.string().min(1)).min(1),
    recordPath: z.string(),
    idPath: z.string().nullable(),
    timestampPath: z.string().nullable(),
    pagination: z
      .object({
        strategy: z.enum([
          "none",
          "offset",
          "cursor",
          "next-link",
          "page-number",
          "provider-specific",
        ]),
        nextPath: z.string().min(1).nullable(),
      })
      .strict(),
    normalization: z
      .object({
        fields: z.record(z.string(), z.string()),
        language: z.string().min(1).nullable(),
        geometry: z.string().min(1).nullable(),
        timestamp: z.string().min(1).nullable(),
      })
      .strict(),
  })
  .strict();

const accessRecipeShape = {
  schemaVersion: z.literal(1),
  sourceReference: z.string().regex(/^HKAPI-[0-9]{3}$/),
  recipeVersion: z.string().regex(/^[0-9]+\.[0-9]+\.[0-9]+$/),
  adapter: adapterNameSchema,
  status: accessStatusSchema,
  documentationUrl: z.url().startsWith("https://"),
  limitations: z.array(z.string().min(1)).min(1),
  authentication: authenticationSchema,
  request: requestSchema.nullable(),
  response: responseSchema.nullable(),
  reason: z.string().min(1).nullable(),
  nextAction: z.string().min(1).nullable(),
} as const;

type RecipeContract = z.infer<z.ZodObject<typeof accessRecipeShape>>;

function refineRecipe(recipe: RecipeContract, context: z.RefinementCtx): void {
  if (["manual-only", "blocked"].includes(recipe.status)) {
    if (recipe.request !== null) {
      context.addIssue({ code: "custom", message: `${recipe.status} recipes cannot define a request` });
    }
    if (recipe.adapter !== "none" || recipe.response !== null) {
      context.addIssue({ code: "custom", message: `${recipe.status} recipes are not executable` });
    }
  }
}

export const accessRecipeSchema = z.object(accessRecipeShape).strict().superRefine(refineRecipe);

export const verificationSummarySchema = z
  .object({
    checkedAt: z.iso.datetime(),
    validUntil: z.iso.datetime(),
    outcome: z.enum(["success", "failure"]),
    errorCode: z.string().min(1).nullable(),
    recipeSha256: z.string().regex(/^[a-f0-9]{64}$/),
    finalHost: z.string().min(1),
    httpStatus: z.number().int().min(100).max(599).nullable(),
    elapsedMs: z.number().int().nonnegative(),
    mediaType: z.string().min(1).nullable(),
    responseBytes: z.number().int().nonnegative(),
    responseSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    schemaFingerprint: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
    parsedRecordCount: z.number().int().nonnegative(),
    limitations: z.array(z.string().min(1)),
    toolVersion: z.string().min(1),
  })
  .strict();

export const generatedAccessRecipeSchema = z
  .object({
    ...accessRecipeShape,
    recipeSha256: z.string().regex(/^[a-f0-9]{64}$/),
    effectiveStatus: accessStatusSchema,
    examples: z
      .object({
        curl: z.string().min(1).nullable(),
        python: z.string().min(1).nullable(),
        typescript: z.string().min(1).nullable(),
      })
      .strict(),
    verification: verificationSummarySchema.nullable(),
  })
  .strict()
  .superRefine(refineRecipe);

export const accessCoverageSchema = z
  .object({
    totalOfficial: z.number().int().nonnegative(),
    unclassified: z.number().int().nonnegative(),
    byStatus: z.record(accessStatusSchema, z.number().int().nonnegative()),
  })
  .strict();

export const accessRecipeIndexSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: z.iso.datetime().nullable(),
    recipes: z.array(generatedAccessRecipeSchema),
    coverage: accessCoverageSchema,
  })
  .strict();

export type AccessRecipe = z.infer<typeof accessRecipeSchema>;
export type GeneratedAccessRecipe = z.infer<typeof generatedAccessRecipeSchema>;
export type AccessRecipeIndex = z.infer<typeof accessRecipeIndexSchema>;
export type AccessStatus = z.infer<typeof accessStatusSchema>;

export const dataGovResourceAccessSchema = z.enum([
  "ready",
  "parameters-required",
  "insecure-http",
  "invalid-url",
]);

export const dataGovResourceTransportSchema = z.enum(["https", "http", "invalid"]);
export const dataGovResourceKindSchema = z.enum([
  "api",
  "file",
  "dataset-page",
  "geoportal",
  "web-page",
  "unknown",
]);

export const dataGovResourceSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceReferences: z.array(z.string().regex(/^HKAPI-[0-9]{3}$/)).min(1),
    datasetId: z.string().min(1),
    resourceId: z.string().min(1),
    name: z.string().min(1),
    format: z.string().min(1),
    urlTemplate: z.string().min(1),
    templateParameters: z.array(z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/)),
    access: dataGovResourceAccessSchema,
    transport: dataGovResourceTransportSchema,
    resourceKind: dataGovResourceKindSchema,
  })
  .strict()
  .superRefine((resource, context) => {
    const expected = resource.urlTemplate.startsWith("http://")
      ? "insecure-http"
      : resource.urlTemplate.startsWith("https://")
        ? resource.templateParameters.length > 0
          ? "parameters-required"
          : "ready"
        : "invalid-url";
    if (resource.access !== expected) {
      context.addIssue({ code: "custom", message: `resource access must be ${expected}` });
    }
    const expectedTransport = resource.access === "insecure-http"
      ? "http"
      : resource.access === "invalid-url"
        ? "invalid"
        : "https";
    if (resource.transport !== expectedTransport) {
      context.addIssue({
        code: "custom",
        message: `resource transport must be ${expectedTransport}`,
      });
    }
    if (new Set(resource.sourceReferences).size !== resource.sourceReferences.length) {
      context.addIssue({ code: "custom", message: "source references must be unique" });
    }
    if (new Set(resource.templateParameters).size !== resource.templateParameters.length) {
      context.addIssue({ code: "custom", message: "template parameters must be unique" });
    }
  });

export const dataGovDatasetSchema = z
  .object({
    schemaVersion: z.literal(1),
    sourceReferences: z.array(z.string().regex(/^HKAPI-[0-9]{3}$/)).min(1),
    datasetId: z.string().min(1),
    title: z.string().min(1),
    description: z.string(),
    providerName: z.string().min(1).nullable(),
    landingUrl: z.url().startsWith("https://"),
    modifiedAt: z.string().min(1).nullable(),
    resourceCount: z.number().int().nonnegative(),
    formats: z.array(z.string().min(1)),
  })
  .strict();

export const dataGovResourceInventorySchema = z
  .object({
    schemaVersion: z.literal(1),
    checkedAt: z.iso.datetime(),
    packageEndpoint: z.url().startsWith("https://"),
    datasets: z.array(dataGovDatasetSchema).default([]),
    resources: z.array(dataGovResourceSchema),
  })
  .strict();

export type DataGovResource = z.infer<typeof dataGovResourceSchema>;
export type DataGovDataset = z.infer<typeof dataGovDatasetSchema>;
export type DataGovResourceInventory = z.infer<typeof dataGovResourceInventorySchema>;

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function loadAccessRecipeIndex(
  path = resolve(workspaceRoot, "access/generated/recipes.json"),
): AccessRecipeIndex {
  return accessRecipeIndexSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
}

export function loadDataGovResourceInventory(
  path = resolve(workspaceRoot, "access/generated/data-gov-resources.json"),
): DataGovResourceInventory {
  return dataGovResourceInventorySchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
}
