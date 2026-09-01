import { describe, expect, it } from "vitest";

import { loadCatalogue } from "./catalogue.js";

describe("public catalogue contract", () => {
  it("loads all namespaced resources with the five evidence states", () => {
    const catalogue = loadCatalogue();
    expect(catalogue.resources).toHaveLength(521);
    expect(new Set(catalogue.resources.map((resource) => resource.id)).size).toBe(521);
    expect(catalogue.resources.filter((resource) => resource.type === "official")).toHaveLength(265);
    expect(catalogue.resources.every((resource) => resource.termsEvidence.checkedAt !== "")).toBe(
      true,
    );
    const official = catalogue.resources.find(
      (resource) => resource.sourceReference === "HKAPI-001",
    );
    expect(official).toMatchObject({
      integrations: { connector: "available" },
      accessRecipe: {
        sourceReference: "HKAPI-001",
        effectiveStatus: "live-verified",
      },
    });
    expect(catalogue.counts).toMatchObject({
      accessExecutable: 37,
      accessLiveVerified: 29,
      byAccessStatus: { "live-verified": 29, "fixture-tested": 8, "manual-only": 228 },
    });
  });
});
