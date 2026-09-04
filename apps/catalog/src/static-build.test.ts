import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

describe("static catalogue build", () => {
  it("creates a permanent detail page for every validated resource", () => {
    const appRoot = resolve(import.meta.dirname, "..");
    execFileSync("node", ["scripts/build-static.mjs"], { cwd: appRoot, stdio: "pipe" });

    const detail = readFileSync(
      resolve(appRoot, "dist/resources/official%3Ahkapi-001/index.html"),
      "utf8",
    );
    expect(detail).toContain(
      '<link rel="canonical" href="https://angusf777.github.io/hk-open-data/resources/official%3Ahkapi-001/" />',
    );
    expect(detail).toContain('window.__HK_OPEN_DATA_RESOURCE_ID__="official:hkapi-001"');
    const providerResources = JSON.parse(
      readFileSync(resolve(appRoot, "dist/data-gov-resources.json"), "utf8"),
    );
    expect(providerResources.resources.length).toBeGreaterThan(5_000);
    expect(providerResources.resources[0]).toHaveProperty("resourceKind");
    expect(providerResources.resources[0]).toHaveProperty("transport");
    expect(providerResources.resources[0]).toHaveProperty("verification.status");
    expect(
      providerResources.resources.some(
        (resource: { verification: { status: string } }) =>
          resource.verification.status === "live-verified",
      ),
    ).toBe(true);

    const providerBrowser = readFileSync(
      resolve(appRoot, "dist/provider-resources/index.html"),
      "utf8",
    );
    expect(providerBrowser).toContain(
      '<link rel="canonical" href="https://angusf777.github.io/hk-open-data/provider-resources/" />',
    );
    expect(providerBrowser).toContain('href="../data-gov-resources.json"');
    const exportedResources = JSON.parse(
      readFileSync(resolve(appRoot, "dist/downloads/provider-resources.json"), "utf8"),
    );
    expect(exportedResources.resources).toHaveLength(providerResources.resources.length);
    expect(
      readFileSync(resolve(appRoot, "dist/downloads/provider-resources.csv"), "utf8"),
    ).toContain("verification_status");
    expect(
      readFileSync(resolve(appRoot, "dist/downloads/hk-open-data.sqlite")),
    ).not.toHaveLength(0);

    const dataset = readFileSync(
      resolve(appRoot, "dist/datasets/nlb-bus-nlb-bus-service-v2/index.html"),
      "utf8",
    );
    expect(dataset).toContain(
      '<link rel="canonical" href="https://angusf777.github.io/hk-open-data/datasets/nlb-bus-nlb-bus-service-v2/" />',
    );
    expect(dataset).toContain(
      'window.__HK_OPEN_DATA_DATASET_ID__="nlb-bus-nlb-bus-service-v2"',
    );

    const category = readFileSync(
      resolve(appRoot, "dist/categories/transportation/index.html"),
      "utf8",
    );
    expect(category).toContain(
      '<link rel="canonical" href="https://angusf777.github.io/hk-open-data/categories/transportation/" />',
    );
    expect(category).toContain('window.__HK_OPEN_DATA_CATEGORY__="transportation"');
    expect(category).toContain('"@type":"CollectionPage"');
    expect(readFileSync(resolve(appRoot, "dist/index.html"), "utf8")).toContain(
      '"@type":"WebSite"',
    );
    expect(JSON.parse(readFileSync(resolve(appRoot, "dist/dcat.jsonld"), "utf8"))).toMatchObject(
      { "@type": "dcat:Catalog" },
    );
    expect(readFileSync(resolve(appRoot, "dist/llms.txt"), "utf8")).toContain(
      "# HK Open Data",
    );
    expect(
      JSON.parse(readFileSync(resolve(appRoot, "dist/contracts/openapi.json"), "utf8")),
    ).toHaveProperty("openapi", "3.1.0");
  }, 30_000);
});
