import { describe, expect, it } from "vitest";

import { catalogueLocation, parseCatalogueLocation } from "./catalogue-state";

describe("catalogue URL state", () => {
  it("round-trips supported search and filter state through a permanent category URL", () => {
    const location = catalogueLocation("/hk-open-data/", "air quality", {
      category: "environment",
      type: "official",
      authentication: "none",
      access: "live",
      termsState: "not-reviewed",
    });

    expect(location).toBe(
      "/hk-open-data/categories/environment/?q=air+quality&type=official&auth=none&access=live&terms=not-reviewed",
    );
    expect(parseCatalogueLocation(location)).toEqual({
      query: "air quality",
      filters: {
        category: "environment",
        type: "official",
        authentication: "none",
        access: "live",
        termsState: "not-reviewed",
      },
    });
  });

  it("ignores unsupported filter values", () => {
    expect(parseCatalogueLocation("/?type=broken&access=broken&auth=oauth2")).toEqual({
      query: "",
      filters: {},
    });
  });
});
