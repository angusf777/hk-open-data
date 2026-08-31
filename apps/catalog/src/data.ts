import type { Catalogue } from "./types";

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
