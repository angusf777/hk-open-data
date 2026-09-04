import type { Resource } from "./types";

export type CatalogueExportFormat = "json" | "csv";

interface CatalogueExport {
  contents: string;
  filename: string;
  mediaType: string;
}

const csvFields = [
  "id",
  "source_reference",
  "type",
  "name_en",
  "provider_en",
  "categories",
  "protocols",
  "formats",
  "authentication",
  "access",
  "verification_status",
  "checked_at",
  "landing_url",
  "documentation_url",
  "terms_state",
] as const;

function csvCell(value: unknown): string {
  let text = Array.isArray(value) ? value.join(";") : String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvRow(resource: Resource): Record<(typeof csvFields)[number], unknown> {
  return {
    id: resource.id,
    source_reference: resource.sourceReference,
    type: resource.type,
    name_en: resource.name.en,
    provider_en: resource.provider.name.en,
    categories: resource.categories,
    protocols: resource.protocols,
    formats: resource.formats,
    authentication: resource.authentication,
    access: resource.access,
    verification_status: resource.verification.status,
    checked_at: resource.verification.checkedAt,
    landing_url: resource.urls.landing,
    documentation_url: resource.urls.documentation,
    terms_state: resource.termsEvidence.state,
  };
}

export function formatCatalogueExport(
  resources: Resource[],
  format: CatalogueExportFormat,
): CatalogueExport {
  if (format === "json") {
    return {
      contents: `${JSON.stringify({ schemaVersion: 1, count: resources.length, resources }, null, 2)}\n`,
      filename: "hk-open-data-filtered-sources.json",
      mediaType: "application/json",
    };
  }
  const rows = [
    csvFields.map(csvCell).join(","),
    ...resources.map((resource) => {
      const values = csvRow(resource);
      return csvFields.map((field) => csvCell(values[field])).join(",");
    }),
  ];
  return {
    contents: `${rows.join("\n")}\n`,
    filename: "hk-open-data-filtered-sources.csv",
    mediaType: "text/csv;charset=utf-8",
  };
}

export function downloadCatalogueExport(
  resources: Resource[],
  format: CatalogueExportFormat,
): void {
  const output = formatCatalogueExport(resources, format);
  const url = URL.createObjectURL(new Blob([output.contents], { type: output.mediaType }));
  const link = document.createElement("a");
  link.href = url;
  link.download = output.filename;
  link.click();
  URL.revokeObjectURL(url);
}
