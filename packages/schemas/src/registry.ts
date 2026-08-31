import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { parse } from "csv-parse/sync";
import { z } from "zod";

export const CONTRACT_VERSION = "2026-08-28.v1" as const;

const pendingStatus = z.literal("specified_pending_approval");
const sourceGroupId = z.string().regex(/^P01-SG-(0[1-9]|10)$/);
const sourceId = z.string().regex(/^HKAPI-[0-9]{3}$/);

const sourceGroupRow = z
  .object({
    source_group_id: sourceGroupId,
    source_ids: z.string().min(1),
    name: z.string().min(1),
    provider: z.string().min(1),
    protocols: z.string().min(1),
    first_connector_scope: z.string().min(1),
    nominal_cadence: z.string().min(1),
    raw_retention_class: z.string().min(1),
    activation_gate: z.string().min(1),
    operator_hint: z.string().min(1),
    status: pendingStatus,
  })
  .strict();

const monitorRow = z
  .object({
    monitor_id: z.string().regex(/^P14-M[0-9]{3}$/),
    source_id: sourceId,
    source_group_id: z.union([sourceGroupId, z.literal("P14-ONLY-01")]),
    provider: z.string().min(1),
    name: z.string().min(1),
    method: z.enum(["GET", "POST"]),
    request_template: z.string().startsWith("https://"),
    request_body_json: z.string(),
    cadence_seconds: z.coerce.number().int().positive(),
    timeout_ms: z.coerce.number().int().min(100).max(120_000),
    freshness_rule: z.string().min(1),
    required_checks: z.string().min(1),
    public_visibility: z.enum(["public", "private", "pending_review", "private_until_review"]),
    activation_status: pendingStatus,
    documentation_url: z.string().url(),
    notes: z.string(),
  })
  .strict();

export interface SourceGroupDefinition {
  sourceGroupId: string;
  sourceIds: string[];
  name: string;
  provider: string;
  protocols: string[];
  firstConnectorScope: string[];
  nominalCadence: string;
  rawRetentionClass: string;
  activationGate: string[];
  operatorHint: string;
  status: "specified_pending_approval";
}

export interface MonitorTargetDefinition {
  monitorId: string;
  sourceId: string;
  sourceGroupId: string;
  provider: string;
  name: string;
  method: "GET" | "POST";
  requestTemplate: string;
  requestBody: unknown | null;
  cadenceSeconds: number;
  timeoutMs: number;
  freshnessRule: string;
  requiredChecks: string[];
  publicVisibility: "public" | "private" | "pending_review" | "private_until_review";
  activationStatus: "specified_pending_approval";
  documentationUrl: string;
  notes: string;
}

const contractDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "../contracts");

function parseRows(csv: string): Record<string, string>[] {
  return parse(csv, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
  }) as Record<string, string>[];
}

function parseRegistryRow<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) {
    return result.data;
  }
  const details = result.error.issues
    .map((issue) => `${issue.path.join(".") || "row"}: ${issue.message}`)
    .join("; ");
  throw new Error(details);
}

export function parseSourceGroups(csv: string): SourceGroupDefinition[] {
  return parseRows(csv).map((unparsed, index) => {
    const row = parseRegistryRow(sourceGroupRow, unparsed);
    const sourceIds = row.source_ids.split(";").map((value) => sourceId.parse(value));
    if (new Set(sourceIds).size !== sourceIds.length) {
      throw new Error(`source_ids contains a duplicate in row ${index + 2}`);
    }
    return {
      sourceGroupId: row.source_group_id,
      sourceIds,
      name: row.name,
      provider: row.provider,
      protocols: row.protocols.split(";"),
      firstConnectorScope: row.first_connector_scope.split(";"),
      nominalCadence: row.nominal_cadence,
      rawRetentionClass: row.raw_retention_class,
      activationGate: row.activation_gate.split(";").map((value) => value.trim()),
      operatorHint: row.operator_hint,
      status: row.status,
    };
  });
}

function parseRequestBody(method: "GET" | "POST", value: string): unknown | null {
  if (value === "") {
    if (method === "POST") {
      throw new Error("request_body_json must contain valid JSON for POST monitors");
    }
    return null;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("request_body_json must contain valid JSON");
  }
}

export function parseMonitorTargets(csv: string): MonitorTargetDefinition[] {
  return parseRows(csv).map((unparsed) => {
    const row = parseRegistryRow(monitorRow, unparsed);
    return {
      monitorId: row.monitor_id,
      sourceId: row.source_id,
      sourceGroupId: row.source_group_id,
      provider: row.provider,
      name: row.name,
      method: row.method,
      requestTemplate: row.request_template,
      requestBody: parseRequestBody(row.method, row.request_body_json),
      cadenceSeconds: row.cadence_seconds,
      timeoutMs: row.timeout_ms,
      freshnessRule: row.freshness_rule,
      requiredChecks: row.required_checks.split(";"),
      publicVisibility: row.public_visibility,
      activationStatus: row.activation_status,
      documentationUrl: row.documentation_url,
      notes: row.notes,
    };
  });
}

export function loadSourceGroups(path = resolve(contractDirectory, "p01-source-groups.csv")): SourceGroupDefinition[] {
  const groups = parseSourceGroups(readFileSync(path, "utf8"));
  const expectedIds = Array.from(
    { length: 10 },
    (_, index) => `P01-SG-${String(index + 1).padStart(2, "0")}`,
  );
  if (groups.length !== 10 || groups.some((group, index) => group.sourceGroupId !== expectedIds[index])) {
    throw new Error("source group registry must contain sequential P01-SG-01 through P01-SG-10");
  }
  return groups;
}

export function loadMonitorTargets(path = resolve(contractDirectory, "p14-monitor-targets.csv")): MonitorTargetDefinition[] {
  const targets = parseMonitorTargets(readFileSync(path, "utf8"));
  const expectedIds = Array.from(
    { length: 50 },
    (_, index) => `P14-M${String(index + 1).padStart(3, "0")}`,
  );
  if (targets.length !== 50 || targets.some((target, index) => target.monitorId !== expectedIds[index])) {
    throw new Error("monitor registry must contain sequential P14-M001 through P14-M050");
  }
  return targets;
}
