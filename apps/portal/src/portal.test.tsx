// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PortalApp } from "./App.js";
import {
  createSnapshotPortalApi,
  type PortalApi,
  type SnapshotStorage,
} from "./api.js";

afterEach(cleanup);

function api(generatedAt = "2026-08-28T10:24:00Z"): PortalApi {
  const live: Omit<PortalApi, "getDashboard"> = {
    getStatus: vi.fn(async () => ({ generatedAt, overall: "degraded", snapshot: false, counts: { operational: 43, degraded: 5, outage: 2, unknown: 0 } })),
    listIncidents: vi.fn(async () => [
      { id: "INC-1", sourceId: "HKAPI-021", sourceName: "CSDI WFS", provider: "Development Bureau (CSDI)", severity: "major", state: "investigating", openedAt: "2026-08-28T09:12:00Z", summary: "Reviewed schema impact", reviewed: true },
      { id: "INC-PRIVATE", sourceId: "HKAPI-999", sourceName: "Private connector", provider: "Private", severity: "critical", state: "candidate", openedAt: "2026-08-28T09:13:00Z", summary: "Internal note", reviewed: false },
    ]),
    listSources: vi.fn(async () => [{ id: "HKAPI-021", name: "CSDI WFS", provider: "Development Bureau (CSDI)", authority: "official", freshness: "stale", lastObserved: "2026-08-28T09:12:00Z", limitations: ["Provider schema changed"], termsEvidenceState: "official-terms-linked" as const, activationStatus: "specified_pending_approval" }]),
  };
  return createSnapshotPortalApi(live);
}

describe("public status and developer portal", () => {
  it("shows only reviewed incidents and the independent-monitoring notice", async () => {
    render(<PortalApp api={api()} operatingProfile="observe" now={() => new Date("2026-08-28T10:30:00Z")} initialEntries={["/"]} />);
    expect(await screen.findByRole("heading", { name: "Public data status" })).toBeVisible();
    expect(screen.getByText("Reviewed schema impact")).toBeVisible();
    expect(screen.queryByText("Internal note")).not.toBeInTheDocument();
    expect(screen.getByText(/not provider endorsement/i)).toBeVisible();
    expect(screen.getByText(/self-hosted observe profile/i)).toBeVisible();
  });

  it("distinguishes terms evidence from runtime activation", async () => {
    render(
      <PortalApp api={api()} operatingProfile="observe" initialEntries={["/sources"]} />,
    );

    expect(await screen.findByText(/terms evidence: official terms linked/i)).toBeVisible();
    expect(screen.getByText(/source access: not activated/i)).toBeVisible();
    expect(screen.queryByText(/approved for use/i)).not.toBeInTheDocument();
  });

  it("labels an expired response as a last-known snapshot", async () => {
    render(<PortalApp api={api("2026-08-27T01:00:00Z")} now={() => new Date("2026-08-28T10:30:00Z")} initialEntries={["/"]} />);
    expect(await screen.findByText("Last-known snapshot")).toBeVisible();
    expect(screen.getByText(/Status data is older than the publication window/)).toBeVisible();
  });

  it("serves the last complete reviewed snapshot during an API outage", async () => {
    const values = new Map<string, string>();
    const storage: SnapshotStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    };
    let unavailable = false;
    const live = {
      async getStatus() {
        if (unavailable) throw new Error("offline");
        return { generatedAt: "2026-08-28T10:24:00Z", overall: "operational", snapshot: false, counts: { operational: 1, degraded: 0, outage: 0, unknown: 0 } };
      },
      async listIncidents() { return []; },
      async listSources() { return [{ id: "HKAPI-001", name: "DATA.GOV.HK", provider: "DPO", authority: "official", freshness: "fresh", lastObserved: "2026-08-28T10:23:00Z", limitations: [] }]; },
    };
    const cachedApi = createSnapshotPortalApi(live, storage);
    expect((await cachedApi.getDashboard()).status.snapshot).toBe(false);
    unavailable = true;

    render(<PortalApp api={cachedApi} now={() => new Date("2026-08-28T10:30:00Z")} initialEntries={["/"]} />);

    expect(await screen.findByText("Last-known snapshot")).toBeVisible();
    expect(screen.getByText("DATA.GOV.HK")).toBeVisible();
  });

  it("switches public navigation and status copy to Traditional Chinese", async () => {
    const user = userEvent.setup();
    render(<PortalApp api={api()} now={() => new Date("2026-08-28T10:30:00Z")} initialEntries={["/"]} />);
    await screen.findByRole("heading", { name: "Public data status" });
    await user.click(screen.getByRole("button", { name: "繁體中文" }));
    expect(screen.getByRole("heading", { name: "公共數據狀態" })).toBeVisible();
    expect(screen.getByText(/獨立監察/)).toBeVisible();
  });

  it("keeps status summary, notice, incidents and sources in the mobile reading order", async () => {
    render(<PortalApp api={api()} now={() => new Date("2026-08-28T10:30:00Z")} initialEntries={["/"]} />);
    await screen.findByRole("heading", { name: "Public data status" });
    const main = screen.getByRole("main");
    expect(within(main).getAllByTestId(/public-section/).map((item) => item.getAttribute("data-section"))).toEqual(["summary", "notice", "incidents", "sources"]);
  });
});
