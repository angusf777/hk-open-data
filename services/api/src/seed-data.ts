import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  loadCatalogue,
  loadMonitorTargets,
  loadSourceGroups,
  type CatalogueResource,
  type MonitorTargetDefinition,
  type SourceGroupDefinition,
} from "@hk-open-data/schemas";

import type { SourceDefinition } from "./domain.js";

export interface SourceGroupSeed extends SourceGroupDefinition {
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorTargetSeed extends MonitorTargetDefinition {
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSeedData {
  sourceGroups: SourceGroupSeed[];
  sources: SourceDefinition[];
  monitorTargets: MonitorTargetSeed[];
}

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export interface SeedPaths {
  cataloguePath: string;
  sourceGroupsPath: string;
  monitorTargetsPath: string;
}

const defaultPaths: SeedPaths = {
  cataloguePath: resolve(workspaceRoot, "catalog/generated/catalogue.json"),
  sourceGroupsPath: resolve(workspaceRoot, "packages/schemas/contracts/p01-source-groups.csv"),
  monitorTargetsPath: resolve(
    workspaceRoot,
    "packages/schemas/contracts/p14-monitor-targets.csv",
  ),
};

function numericSourceId(sourceId: string): number {
  return Number.parseInt(sourceId.slice("HKAPI-".length), 10);
}

export function buildSeedData(
  now: string,
  pathOverrides: Partial<SeedPaths> = {},
): PlatformSeedData {
  const timestamp = new Date(now).toISOString();
  const paths = { ...defaultPaths, ...pathOverrides };
  const sourceGroups = loadSourceGroups(paths.sourceGroupsPath);
  const monitorTargets = loadMonitorTargets(paths.monitorTargetsPath);
  const catalogue = loadCatalogue(paths.cataloguePath);
  const catalogueByReference = new Map<string, CatalogueResource>(
    catalogue.resources.map((resource) => [resource.sourceReference, resource]),
  );
  const groupBySource = new Map<string, SourceGroupDefinition>();

  for (const group of sourceGroups) {
    for (const sourceId of group.sourceIds) {
      if (groupBySource.has(sourceId)) {
        throw new Error(`Source ${sourceId} appears in more than one P01 group`);
      }
      groupBySource.set(sourceId, group);
    }
  }

  const sourceIds = new Set(groupBySource.keys());
  for (const target of monitorTargets) {
    sourceIds.add(target.sourceId);
  }

  const sources = [...sourceIds]
    .sort((left, right) => numericSourceId(left) - numericSourceId(right))
    .map((sourceId): SourceDefinition => {
      const catalogueSource = catalogueByReference.get(sourceId);
      if (catalogueSource === undefined) {
        throw new Error(`Public catalogue does not contain source reference ${sourceId}`);
      }
      const group = groupBySource.get(sourceId);
      const monitor = monitorTargets.find((target) => target.sourceId === sourceId);
      return {
        sourceId,
        catalogueId: catalogueSource.id,
        catalogueVerifiedAt: catalogueSource.verification.checkedAt,
        termsEvidenceState: catalogueSource.termsEvidence.state,
        sourceGroupId: group?.sourceGroupId ?? null,
        projects: group === undefined ? ["P14"] : ["P01", "P14"],
        name: catalogueSource.name.en,
        provider: catalogueSource.provider.name.en,
        authorityClass: "official",
        approvalStatus: "specified_pending_approval",
        visibility: "private",
        freshnessStatus: "unknown",
        lastSuccessAt: null,
        documentationUrl: catalogueSource.urls.documentation ?? catalogueSource.urls.landing,
        cadence: group?.nominalCadence ?? `${monitor?.cadenceSeconds ?? 0} seconds`,
        approvedUses: [],
        limitations: [
          catalogueSource.termsEvidence.note.en,
          ...catalogueSource.termsEvidence.restrictions.map((restriction) => restriction.en),
        ],
        version: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    });

  return {
    sourceGroups: sourceGroups.map((group) => ({
      ...group,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
    sources,
    monitorTargets: monitorTargets.map((target) => ({
      ...target,
      version: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    })),
  };
}
