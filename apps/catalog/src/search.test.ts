import { describe, expect, it } from "vitest";

import { searchResources } from "./search";
import { fixtureResources } from "./test-fixtures";

describe("searchResources", () => {
  it("matches English, Traditional Chinese, provider and tags", () => {
    expect(searchResources(fixtureResources, "天文台", {}).map((item) => item.id)).toEqual([
      "official:hko",
    ]);
    expect(searchResources(fixtureResources, "weather", {}).map((item) => item.id)).toEqual([
      "official:hko",
    ]);
    expect(searchResources(fixtureResources, "forecast", {}).map((item) => item.id)).toEqual([
      "official:hko",
    ]);
  });

  it("combines type, authentication and evidence filters", () => {
    expect(
      searchResources(fixtureResources, "", {
        type: "official",
        authentication: "none",
        termsState: "ambiguity-identified",
      }),
    ).toHaveLength(1);
  });

  it("filters resources by executable recipe", () => {
    const executable = {
      ...fixtureResources[0],
      accessRecipe: { request: {} },
    } as (typeof fixtureResources)[number];

    expect(searchResources([executable, fixtureResources[1]!], "", { access: "executable" })).toEqual([
      executable,
    ]);
  });

  it("ranks official sources before external and MCP entries by default", () => {
    expect(searchResources(fixtureResources, "", {}).map((item) => item.type)).toEqual([
      "official",
      "external",
    ]);
  });
});
