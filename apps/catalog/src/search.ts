import type { Resource, ResourceFilters } from "./types";

export function searchResources(
  resources: Resource[],
  query: string,
  filters: ResourceFilters,
): Resource[] {
  const needle = query.trim().toLocaleLowerCase();

  return resources
    .filter((resource) => {
      const haystack = [
        resource.id,
        resource.sourceReference,
        resource.name.en,
        resource.name["zh-Hant"],
        resource.summary.en,
        resource.summary["zh-Hant"],
        resource.provider.name.en,
        resource.provider.name["zh-Hant"],
        ...resource.categories,
        ...(resource.tags ?? []),
        ...resource.protocols,
        ...resource.formats,
      ]
        .join(" ")
        .toLocaleLowerCase();

      return (
        (!needle || haystack.includes(needle)) &&
        (!filters.type || resource.type === filters.type) &&
        (!filters.authentication || resource.authentication === filters.authentication) &&
        (!filters.termsState || resource.termsEvidence.state === filters.termsState) &&
        (!filters.category || resource.categories.includes(filters.category))
      );
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}
