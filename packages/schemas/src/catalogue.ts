import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { z } from "zod";

export const termsEvidenceStateSchema = z.enum([
  "not-reviewed",
  "official-terms-linked",
  "restriction-identified",
  "ambiguity-identified",
  "provider-confirmation-recorded",
]);

const localizedTextSchema = z.object({
  en: z.string().min(1),
  "zh-Hant": z.string().min(1),
});

export const catalogueResourceSchema = z.object({
  id: z.string().regex(/^(official|external|mcp):[a-z0-9][a-z0-9-]*$/),
  sourceReference: z.string().min(1),
  type: z.enum(["official", "external", "mcp"]),
  name: localizedTextSchema,
  provider: z.object({ name: localizedTextSchema, type: z.string().min(1) }),
  urls: z.object({
    landing: z.string().url().nullable(),
    documentation: z.string().url().nullable(),
    terms: z.string().url().nullable(),
  }),
  verification: z.object({
    status: z.string().min(1),
    checkedAt: z.string().date(),
    evidenceUrl: z.string().url(),
  }),
  termsEvidence: z.object({
    state: termsEvidenceStateSchema,
    checkedAt: z.string().date(),
    note: localizedTextSchema,
    restrictions: z.array(localizedTextSchema),
  }),
});

export const catalogueSchema = z.object({
  schemaVersion: z.literal(1),
  resources: z.array(catalogueResourceSchema),
});

export type Catalogue = z.infer<typeof catalogueSchema>;
export type CatalogueResource = z.infer<typeof catalogueResourceSchema>;
export type TermsEvidenceState = z.infer<typeof termsEvidenceStateSchema>;

const workspaceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

export function loadCatalogue(
  path = resolve(workspaceRoot, "catalog/generated/catalogue.json"),
): Catalogue {
  return catalogueSchema.parse(JSON.parse(readFileSync(path, "utf8")) as unknown);
}
