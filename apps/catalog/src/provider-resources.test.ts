import { describe, expect, it } from "vitest";

import {
  filterProviderResources,
  renderProviderResourceCommand,
  resolveProviderResourceUrl,
} from "./provider-resources";
import type { ProviderResource } from "./types";

const parameterized: ProviderResource = {
  schemaVersion: 1,
  sourceReferences: ["HKAPI-076"],
  datasetId: "airport-history",
  resourceId: "past-flights",
  name: "Historical flight schedule",
  format: "JSON",
  urlTemplate: "https://example.gov.hk/flights?date=<date>&label={label}",
  templateParameters: ["date", "label"],
  access: "parameters-required",
};

describe("provider-resource helpers", () => {
  it("resolves only HTTPS templates with all values URL-encoded", () => {
    expect(resolveProviderResourceUrl(parameterized, { date: "2026-09-02", label: "A&B's" })).toBe(
      "https://example.gov.hk/flights?date=2026-09-02&label=A%26B%27s",
    );
    expect(resolveProviderResourceUrl(parameterized, { date: "2026-09-02", label: "" })).toBeNull();
    expect(
      resolveProviderResourceUrl(
        { ...parameterized, access: "insecure-http", urlTemplate: "http://example.gov.hk/<date>" },
        { date: "2026-09-02", label: "unused" },
      ),
    ).toBeNull();
  });

  it("generates bounded no-overwrite examples and shell-quotes CLI values", () => {
    const values = { date: "2026-09-02", label: "$(touch /tmp/nope)" };
    expect(renderProviderResourceCommand(parameterized, "curl", values)).toMatch(
      /--max-filesize 26214400 .*--no-clobber/,
    );
    expect(renderProviderResourceCommand(parameterized, "python", values)).toContain(
      'open("xb")',
    );
    expect(renderProviderResourceCommand(parameterized, "node", values)).toContain(
      '{ flag: "wx" }',
    );
    expect(renderProviderResourceCommand(parameterized, "hkdata", values)).toContain(
      "--param 'label=$(touch /tmp/nope)'",
    );
  });

  it("searches across source, dataset and resource metadata while applying filters", () => {
    const ready = {
      ...parameterized,
      resourceId: "ready",
      name: "Current arrivals",
      urlTemplate: "https://example.gov.hk/current.json",
      templateParameters: [],
      access: "ready",
    } satisfies ProviderResource;
    expect(
      filterProviderResources([parameterized, ready], {
        query: "HKAPI-076 arrivals",
        access: "ready",
        format: "JSON",
      }),
    ).toEqual([ready]);
  });
});
