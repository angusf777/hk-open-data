import type { Catalogue, ProviderResource, ProviderResourceInventory } from "./types";

function isCatalogue(value: unknown): value is Catalogue {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.resources) &&
    typeof candidate.counts === "object" &&
    candidate.counts !== null
  );
}

export async function loadCatalogue(signal?: AbortSignal): Promise<Catalogue> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}catalogue.json`,
    signal ? { signal } : undefined,
  );
  if (!response.ok) throw new Error(`Catalogue request failed (${response.status})`);
  const value: unknown = await response.json();
  if (!isCatalogue(value)) throw new Error("Catalogue schema version is unsupported");
  return value;
}

function isProviderResource(value: unknown): value is ProviderResource {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    Array.isArray(candidate.sourceReferences) &&
    candidate.sourceReferences.every((reference) => typeof reference === "string") &&
    typeof candidate.datasetId === "string" &&
    typeof candidate.resourceId === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.format === "string" &&
    typeof candidate.urlTemplate === "string" &&
    Array.isArray(candidate.templateParameters) &&
    candidate.templateParameters.every((parameter) => typeof parameter === "string") &&
    ["ready", "parameters-required", "insecure-http", "invalid-url"].includes(
      String(candidate.access),
    )
  );
}

function isProviderResourceInventory(value: unknown): value is ProviderResourceInventory {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.schemaVersion === 1 &&
    typeof candidate.checkedAt === "string" &&
    typeof candidate.packageEndpoint === "string" &&
    Array.isArray(candidate.resources) &&
    candidate.resources.every(isProviderResource)
  );
}

export async function loadProviderResourceInventory(
  signal?: AbortSignal,
): Promise<ProviderResourceInventory> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}data-gov-resources.json`,
    signal ? { signal } : undefined,
  );
  if (!response.ok) throw new Error(`Provider-resource request failed (${response.status})`);
  const value: unknown = await response.json();
  if (!isProviderResourceInventory(value)) {
    throw new Error("Provider-resource schema version is unsupported");
  }
  return value;
}
