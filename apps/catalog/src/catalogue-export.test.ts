import { describe, expect, it } from "vitest";

import { formatCatalogueExport } from "./catalogue-export";
import { fixtureResources } from "./test-fixtures";

describe("filtered catalogue exports", () => {
  it("creates JSON and spreadsheet-safe CSV from the selected source metadata", () => {
    const json = formatCatalogueExport(fixtureResources.slice(0, 1), "json");
    expect(JSON.parse(json.contents)).toMatchObject({ count: 1, resources: [{ id: "official:hko" }] });
    expect(json.filename).toBe("hk-open-data-filtered-sources.json");

    const risky = structuredClone(fixtureResources[0]!);
    risky.name.en = "=HYPERLINK(\"https://example.invalid\")";
    const csv = formatCatalogueExport([risky], "csv");
    expect(csv.filename).toBe("hk-open-data-filtered-sources.csv");
    expect(csv.contents).toContain("'=HYPERLINK");
    expect(csv.contents).not.toContain("provider dataset payload");
  });
});
