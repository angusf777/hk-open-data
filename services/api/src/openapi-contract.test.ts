import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import SwaggerParser from "@apidevtools/swagger-parser";
import { loadAccessRecipeIndex } from "@hk-open-data/schemas";
import { Ajv2020 } from "ajv/dist/2020.js";
import * as addFormatsModule from "ajv-formats";
import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";
import type { TokenVerifier } from "./auth.js";
import type { MonitorTarget, SourceDefinition, SourceRecord } from "./domain.js";
import { MemoryPlatformRepository } from "./memory-repository.js";

const observedAt = "2026-08-28T10:00:00.000Z";
const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const openapiPath = resolve(workspaceRoot, "packages/schemas/contracts/openapi.json");

const source: SourceDefinition = {
  sourceId: "HKAPI-001",
  projects: ["P01"],
  name: "DATA.GOV.HK CKAN package list",
  provider: "Digital Policy Office",
  authorityClass: "official",
  approvalStatus: "approved",
  visibility: "public",
  freshnessStatus: "fresh",
  lastSuccessAt: observedAt,
  documentationUrl: "https://data.gov.hk/en/help/ckan-api-development-guide",
  cadence: "daily",
  approvedUses: ["P01 beta"],
  limitations: [],
  version: 2,
  createdAt: observedAt,
  updatedAt: observedAt,
};

const record: SourceRecord = {
  sourceRecordId: "SR-00000001",
  sourceId: "HKAPI-001",
  sourceGroupId: "P01-SG-01",
  provider: "Digital Policy Office",
  authorityClass: "official",
  retrievedAt: observedAt,
  observedAt: observedAt,
  contentType: "application/json",
  rawPayloadHash: "a".repeat(64),
  rawStorageUri: "s3://raw-snapshots/aa/source.json",
  approvalReference: "APP-HKAPI-001-2",
  schemaVersion: "1.0.0",
  freshnessStatus: "fresh",
  qualityFlags: [],
  parentRecordIds: [],
};

const target: MonitorTarget = {
  monitorId: "P14-M001",
  sourceId: "HKAPI-001",
  provider: "Digital Policy Office",
  name: "CKAN package list",
  outcome: "pass",
  lastCheckedAt: observedAt,
  publicVisibility: "public",
  baselineVersion: null,
};

const verifier: TokenVerifier = {
  async verify() {
    return { subject: "viewer", tenantId: "tenant-1", scopes: new Set(["records:read"]), mfa: false };
  },
};

interface DereferencedOpenApi {
  components: { schemas: Record<string, object> };
  paths: Record<string, Record<string, { responses: Record<string, object> }>>;
}

describe("OpenAPI response contract", () => {
  it("declares the shared rate-limit response on every operation", async () => {
    const document = (await SwaggerParser.dereference(openapiPath)) as unknown as DereferencedOpenApi;
    const operations = Object.entries(document.paths).flatMap(([path, pathItem]) =>
      Object.entries(pathItem).map(([method, operation]) => ({ path, method, operation })),
    );

    expect(operations).toHaveLength(26);
    for (const { path, method, operation } of operations) {
      expect(operation.responses["429"], `${method.toUpperCase()} ${path}`).toBeDefined();
    }
  });

  it("validates representative status and source-record responses", async () => {
    const document = (await SwaggerParser.dereference(openapiPath)) as unknown as DereferencedOpenApi;
    const ajv = new Ajv2020({ strict: false, allErrors: true });
    const addFormats = (addFormatsModule.default ?? addFormatsModule) as unknown as (
      instance: Ajv2020,
    ) => Ajv2020;
    addFormats(ajv);
    const validateStatus = ajv.compile(document.components.schemas["StatusSummary"]!);
    const validateRecordPage = ajv.compile(document.components.schemas["SourceRecordPage"]!);
    const validateTargetPage = ajv.compile(document.components.schemas["MonitorTargetPage"]!);
    const validateAccessRecipePage = ajv.compile(
      document.components.schemas["AccessRecipePage"]!,
    );
    const app = buildApp({
      repository: new MemoryPlatformRepository({
        sources: [source],
        sourceRecords: [record],
        monitorTargets: [target],
      }),
      verifier,
      clock: () => new Date(observedAt),
      accessRecipes: loadAccessRecipeIndex().recipes.slice(0, 3),
    });

    const status = await app.inject({ method: "GET", url: "/v1/status/summary" });
    const records = await app.inject({
      method: "GET",
      url: "/v1/source-records",
      headers: { authorization: "Bearer test" },
    });
    const targets = await app.inject({ method: "GET", url: "/v1/monitor-targets" });
    const accessRecipes = await app.inject({ method: "GET", url: "/v1/access-recipes" });

    expect(validateStatus(status.json()), ajv.errorsText(validateStatus.errors)).toBe(true);
    expect(validateRecordPage(records.json()), ajv.errorsText(validateRecordPage.errors)).toBe(true);
    expect(validateTargetPage(targets.json()), ajv.errorsText(validateTargetPage.errors)).toBe(true);
    expect(
      validateAccessRecipePage(accessRecipes.json()),
      ajv.errorsText(validateAccessRecipePage.errors),
    ).toBe(true);
  });
});
