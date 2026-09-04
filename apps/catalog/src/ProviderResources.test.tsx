import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "./App";
import { fixtureCatalogue } from "./test-fixtures";

const inventory = {
  schemaVersion: 1,
  checkedAt: "2026-09-03T03:57:42.512644Z",
  packageEndpoint: "https://data.gov.hk/en-data/api/3/action/package_show",
  resources: [
    {
      schemaVersion: 1,
      sourceReferences: ["HKAPI-030"],
      datasetId: "nlb-bus-service-v2",
      resourceId: "ready-json",
      name: "Bus route information",
      format: "JSON",
      urlTemplate: "https://rt.data.gov.hk/v2/transport/nlb/route.php?action=list",
      templateParameters: [],
      access: "ready",
      transport: "https",
      resourceKind: "api",
      verification: {
        status: "live-verified",
        checkedAt: "2026-09-03T04:00:00Z",
        datasetOutcome: "success",
        httpStatus: 200,
        mediaType: "application/json",
        sampleBytes: 4096,
        elapsedMs: 120,
        errorCode: null,
      },
    },
    {
      schemaVersion: 1,
      sourceReferences: ["HKAPI-076"],
      datasetId: "aahk-flight-info",
      resourceId: "dated-api",
      name: "Historical flight schedule",
      format: "API",
      urlTemplate: "https://example.gov.hk/flights?date=<date>&lang=en",
      templateParameters: ["date"],
      access: "parameters-required",
      transport: "https",
      resourceKind: "api",
      verification: {
        status: "live-verified",
        checkedAt: "2026-09-03T04:00:00Z",
        datasetOutcome: "success",
        httpStatus: 200,
        mediaType: "application/json",
        sampleBytes: 4096,
        elapsedMs: 150,
        errorCode: null,
      },
    },
    {
      schemaVersion: 1,
      sourceReferences: ["HKAPI-099"],
      datasetId: "legacy-statistics",
      resourceId: "legacy-csv",
      name: "Legacy statistics",
      format: "CSV",
      urlTemplate: "http://example.gov.hk/statistics.csv",
      templateParameters: [],
      access: "insecure-http",
      transport: "http",
      resourceKind: "file",
      verification: {
        status: "metadata-only",
        checkedAt: "2026-09-03T03:57:42.512644Z",
        datasetOutcome: "not-probeable",
        httpStatus: null,
        mediaType: null,
        sampleBytes: null,
        elapsedMs: null,
        errorCode: null,
      },
    },
  ],
} as const;

describe("provider-resource browser", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/provider-resources/");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("loads the local inventory only on its route and exposes source-scoped filtering", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(inventory), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    expect(await screen.findByRole("heading", { name: "Browse provider files and endpoints" })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "3 resources" })).toBeVisible();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(String(fetchSpy.mock.calls[0]?.[0])).toBe("/data-gov-resources.json");
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ signal: expect.any(AbortSignal) });

    const user = userEvent.setup();
    await user.type(screen.getByRole("searchbox"), "HKAPI-076");
    expect(screen.getByRole("heading", { name: "1 resource" })).toBeVisible();
    expect(screen.getByText("Historical flight schedule")).toBeVisible();

    await user.clear(screen.getByRole("searchbox"));
    await user.selectOptions(screen.getByLabelText("URL status"), "insecure-http");
    expect(screen.getByRole("heading", { name: "1 resource" })).toBeVisible();
    expect(screen.getByText("Legacy statistics")).toBeVisible();

    await user.selectOptions(screen.getByLabelText("URL status"), "all");
    await user.selectOptions(screen.getByLabelText("Format"), "JSON");
    expect(screen.getByRole("heading", { name: "1 resource" })).toBeVisible();
    expect(screen.getByText("Bus route information")).toBeVisible();
  });

  it("generates copyable commands after required parameters are supplied", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(inventory), { status: 200 }));
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });

    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    const row = await screen.findByRole("article", { name: "Historical flight schedule" });
    await user.click(within(row).getByRole("button", { name: "View usage" }));
    expect(within(row).getByText(/set every required parameter/i)).toBeVisible();
    expect(within(row).getByRole("button", { name: "Copy command" })).toBeDisabled();

    await user.type(within(row).getByLabelText("date"), "2026-09-02");
    await user.click(within(row).getByRole("tab", { name: "hkdata" }));
    const command = within(row).getByText(/hkdata fetch-resource/).textContent ?? "";
    expect(command).toContain("HKAPI-076 dated-api");
    expect(command).toContain("--dataset aahk-flight-info");
    expect(command).toContain("--param date=2026-09-02");

    await user.click(within(row).getByRole("button", { name: "Copy command" }));
    expect(writeText).toHaveBeenCalledWith(command);
    expect(within(row).getByRole("status")).toHaveTextContent("Command copied");
  });

  it("does not offer an executable command for HTTP-only resources", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(inventory), { status: 200 }));
    const user = userEvent.setup();

    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    const row = await screen.findByRole("article", { name: "Legacy statistics" });
    await user.click(within(row).getByRole("button", { name: "View usage" }));
    expect(within(row).getByText(/safe fetching is unavailable/i)).toBeVisible();
    expect(within(row).queryByRole("button", { name: "Copy command" })).not.toBeInTheDocument();
  });

  it("returns to the catalogue without reloading the page", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(inventory), { status: 200 }));
    const user = userEvent.setup();

    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);
    await screen.findByRole("heading", { name: "Browse provider files and endpoints" });
    await user.click(screen.getByRole("button", { name: "Back to catalogue" }));

    expect(screen.getByRole("heading", { name: "Hong Kong public data, mapped and runnable." })).toBeVisible();
    await waitFor(() => expect(window.location.pathname).toBe("/"));
  });
});
