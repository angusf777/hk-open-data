import { describe, expect, it } from "vitest";

import {
  accessRecipeSchema,
  dataGovResourceInventorySchema,
  loadDataGovResourceInventory,
} from "./access.js";

const validRecipe = {
  schemaVersion: 1,
  sourceReference: "HKAPI-001",
  recipeVersion: "1.0.0",
  adapter: "ckan-action",
  status: "fixture-tested",
  documentationUrl: "https://data.gov.hk/en/help/ckan-api-development-guide",
  limitations: ["Metadata response only; dataset-specific terms still apply."],
  authentication: { type: "none", environmentVariables: [], setup: null },
  request: {
    method: "GET",
    urlTemplate: "https://data.gov.hk/en-data/api/3/action/package_list",
    allowedHosts: ["data.gov.hk"],
    parameters: [
      {
        name: "limit",
        location: "query",
        dataType: "integer",
        required: false,
        default: 10,
        example: 10,
        description: "Maximum metadata records returned by this example.",
        enum: [],
      },
    ],
    headers: [{ name: "accept", value: "application/json", environmentVariable: null }],
    bodyTemplate: null,
    timeoutMs: 15_000,
    maxResponseBytes: 1_048_576,
    maxPages: 1,
    retry: { attempts: 2, statusCodes: [408, 429, 500, 502, 503, 504] },
  },
  response: {
    mediaTypes: ["application/json"],
    recordPath: "/result",
    idPath: null,
    timestampPath: null,
    pagination: { strategy: "none", nextPath: null },
    normalization: { fields: {}, language: null, geometry: null, timestamp: null },
  },
  reason: null,
  nextAction: null,
} as const;

describe("access recipe contract", () => {
  it("parses a valid executable recipe", () => {
    const parsed = accessRecipeSchema.parse(validRecipe);

    expect(parsed.sourceReference).toBe("HKAPI-001");
    expect(parsed.request?.allowedHosts).toEqual(["data.gov.hk"]);
  });

  it("rejects unknown statuses", () => {
    expect(() => accessRecipeSchema.parse({ ...validRecipe, status: "currently-working" })).toThrow();
  });

  it("rejects fixed authorization credentials", () => {
    const request = {
      ...validRecipe.request,
      headers: [
        { name: "Authorization", value: "Bearer actual-secret-value", environmentVariable: null },
      ],
    };

    expect(() => accessRecipeSchema.parse({ ...validRecipe, request })).toThrow(
      /credential values are forbidden/i,
    );
  });
});

describe("DATA.GOV.HK resource inventory contract", () => {
  it("loads the generated public inventory", () => {
    const inventory = loadDataGovResourceInventory();

    expect(inventory.resources.length).toBeGreaterThan(5_000);
    expect(inventory.resources.every((resource) => resource.sourceReferences.length > 0)).toBe(
      true,
    );
  });

  it("rejects an HTTPS template incorrectly labelled ready", () => {
    expect(() =>
      dataGovResourceInventorySchema.parse({
        schemaVersion: 1,
        checkedAt: "2026-09-03T00:00:00Z",
        packageEndpoint: "https://data.gov.hk/en-data/api/3/action/package_show",
        resources: [
          {
            schemaVersion: 1,
            sourceReferences: ["HKAPI-030"],
            datasetId: "dataset-one",
            resourceId: "resource-one",
            name: "Stops",
            format: "JSON",
            urlTemplate: "https://example.hk/stops/{routeId}",
            templateParameters: ["routeId"],
            access: "ready",
          },
        ],
      }),
    ).toThrow(/parameters-required/i);
  });
});
