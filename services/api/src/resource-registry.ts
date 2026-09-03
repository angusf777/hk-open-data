import type { DataGovResource } from "@hk-open-data/schemas";

export interface ResourceQuery {
  sourceReference?: string;
  datasetId?: string;
  format?: string;
  access?: DataGovResource["access"];
  cursor?: string;
  limit: number;
}

export interface ResourcePage {
  items: DataGovResource[];
  nextCursor: string | null;
}

function key(resource: DataGovResource): string {
  return `${resource.datasetId}:${resource.resourceId}`;
}

export class ResourceRegistry {
  readonly #resources: readonly DataGovResource[];
  readonly #byKey: ReadonlyMap<string, DataGovResource>;

  constructor(resources: readonly DataGovResource[]) {
    const sorted = [...resources].sort((left, right) => key(left).localeCompare(key(right), "en"));
    const byKey = new Map<string, DataGovResource>();
    for (const resource of sorted) {
      const resourceKey = key(resource);
      if (byKey.has(resourceKey)) throw new Error(`duplicate provider resource: ${resourceKey}`);
      byKey.set(resourceKey, resource);
    }
    this.#resources = Object.freeze(sorted);
    this.#byKey = byKey;
  }

  get(datasetId: string, resourceId: string): DataGovResource | undefined {
    return this.#byKey.get(`${datasetId}:${resourceId}`);
  }

  list(query: ResourceQuery): ResourcePage {
    const filtered = this.#resources.filter(
      (resource) =>
        (query.sourceReference === undefined ||
          resource.sourceReferences.includes(query.sourceReference)) &&
        (query.datasetId === undefined || resource.datasetId === query.datasetId) &&
        (query.format === undefined || resource.format === query.format.toUpperCase()) &&
        (query.access === undefined || resource.access === query.access),
    );
    const start =
      query.cursor === undefined
        ? 0
        : Math.max(0, filtered.findIndex((resource) => key(resource) === query.cursor) + 1);
    const items = filtered.slice(start, start + query.limit);
    return {
      items,
      nextCursor: start + items.length < filtered.length ? (items.at(-1) ? key(items.at(-1)!) : null) : null,
    };
  }
}
