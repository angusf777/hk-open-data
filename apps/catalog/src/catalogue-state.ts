import type { ResourceFilters } from "./types";

const allowed = {
  type: new Set(["official", "external", "mcp"]),
  authentication: new Set(["none", "api-key", "registration"]),
  access: new Set(["executable", "live", "none"]),
  termsState: new Set(["not-reviewed", "ambiguity-identified", "restriction-identified"]),
} as const;

export interface CatalogueState {
  query: string;
  filters: ResourceFilters;
}

export function parseCatalogueLocation(value: string): CatalogueState {
  const url = new URL(value, "https://catalogue.invalid");
  const category = decodeURIComponent(
    url.pathname.match(/\/categories\/([^/]+)\/?$/)?.[1] ?? "",
  );
  const filters: ResourceFilters = {};
  const type = url.searchParams.get("type");
  const authentication = url.searchParams.get("auth");
  const access = url.searchParams.get("access");
  const termsState = url.searchParams.get("terms");
  if (category && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(category)) filters.category = category;
  if (type && allowed.type.has(type)) filters.type = type;
  if (authentication && allowed.authentication.has(authentication)) {
    filters.authentication = authentication;
  }
  if (access && allowed.access.has(access)) {
    filters.access = access as NonNullable<ResourceFilters["access"]>;
  }
  if (termsState && allowed.termsState.has(termsState)) filters.termsState = termsState;
  return { query: url.searchParams.get("q")?.trim() ?? "", filters };
}

export function catalogueLocation(
  basePath: string,
  query: string,
  filters: ResourceFilters,
): string {
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const path = filters.category
    ? `${base}categories/${encodeURIComponent(filters.category)}/`
    : base;
  const search = new URLSearchParams();
  if (query.trim()) search.set("q", query.trim());
  if (filters.type) search.set("type", filters.type);
  if (filters.authentication) search.set("auth", filters.authentication);
  if (filters.access) search.set("access", filters.access);
  if (filters.termsState) search.set("terms", filters.termsState);
  const suffix = search.toString();
  return suffix ? `${path}?${suffix}` : path;
}
