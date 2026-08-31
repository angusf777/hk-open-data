// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AdminApp } from "./App.js";
import type { AdminApi } from "./api.js";

afterEach(cleanup);

function api(): AdminApi {
  return {
    listSources: vi.fn(async () => [
      { id: "HKAPI-001", sourceGroupId: "P01-SG-01", name: "DATA.GOV.HK CKAN", provider: "GovHK", approval: "approved", freshness: "fresh", lastSuccess: "2026-08-28T10:18:00Z", version: 2, termsEvidenceState: "official-terms-linked" },
      { id: "HKAPI-003", sourceGroupId: "P01-SG-01", name: "CSDI WFS", provider: "Lands Department", approval: "pending", freshness: "stale", lastSuccess: "2026-08-28T07:12:00Z", version: 1, termsEvidenceState: "ambiguity-identified" },
    ]),
    listTargets: vi.fn(async () => [{ id: "P14-M001", sourceId: "HKAPI-001", provider: "GovHK", outcome: "pass", lastChecked: "2026-08-28T10:20:00Z", activation: "approved", publicVisibility: "public", baselineVersion: 1, version: 2 }]),
    listIncidents: vi.fn(async () => [{ id: "INC-2026-000001", sourceId: "HKAPI-003", severity: "major", status: "open", openedAt: "2026-08-28T10:05:00Z", version: 3, summary: "Schema changed", publicState: "review_required" }]),
    listDeliveries: vi.fn(async () => [{ id: "DEL-001", eventType: "source.changed", endpoint: "customer.example", status: "retry", attempts: 2, nextAttempt: "2026-08-28T10:30:00Z" }]),
    listAudit: vi.fn(async () => [{ id: "AUD-001", actor: "reviewer@example.hk", action: "source.approved", targetId: "HKAPI-001", reason: "Rights checked", occurredAt: "2026-08-28T09:00:00Z" }]),
    decideSource: vi.fn(async () => undefined),
    activateTarget: vi.fn(async () => undefined),
    activateConnector: vi.fn(async () => undefined),
    actOnIncident: vi.fn(async () => undefined),
  };
}

describe("operator application", () => {
  it("renders the operational overview with source and incident evidence", async () => {
    render(<AdminApp api={api()} initialEntries={["/"]} />);
    expect(await screen.findByRole("heading", { name: "Operations overview" })).toBeVisible();
    expect(await screen.findByText("DATA.GOV.HK CKAN")).toBeVisible();
    expect(screen.getByText("Schema changed")).toBeVisible();
    expect(screen.getByText("Cadence execution (last 24h)")).toBeVisible();
  });

  it("navigates and filters the source register", async () => {
    const user = userEvent.setup();
    render(<AdminApp api={api()} initialEntries={["/sources"]} />);
    expect(await screen.findByRole("heading", { name: "Sources" })).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Approval status"), "pending");
    expect(screen.queryByText("DATA.GOV.HK CKAN")).not.toBeInTheDocument();
    expect(screen.getByText("CSDI WFS")).toBeVisible();
  });

  it("records a source approval with reason, evidence, and optimistic version", async () => {
    const mock = api();
    const user = userEvent.setup();
    render(<AdminApp api={mock} operatingProfile="observe" initialEntries={["/sources/HKAPI-003"]} />);
    await screen.findByRole("heading", { name: /Review source/ });
    expect(screen.getByText(/self-hosted observe profile/i)).toBeVisible();
    expect(screen.getByText(/terms evidence/i)).toBeVisible();
    expect(screen.getByText("ambiguity-identified")).toBeVisible();
    expect(screen.getByText(/runtime activation/i)).toBeVisible();
    await user.type(screen.getByLabelText("Decision reason"), "Terms and retention reviewed");
    await user.type(screen.getByLabelText("Evidence URL"), "https://example.hk/terms");
    await user.click(screen.getByRole("button", { name: "Approve source" }));
    await waitFor(() => expect(mock.decideSource).toHaveBeenCalledOnce());
    expect(mock.decideSource).toHaveBeenCalledWith(
      "HKAPI-003",
      1,
      expect.objectContaining({ reason: "Terms and retention reviewed", evidence: ["https://example.hk/terms"] }),
    );
  });

  it("requires an audited incident reason before acknowledging", async () => {
    const mock = api();
    const user = userEvent.setup();
    render(<AdminApp api={mock} initialEntries={["/incidents"]} />);
    await screen.findByText("Schema changed");
    const acknowledge = screen.getByRole("button", { name: "Acknowledge incident" });
    expect(acknowledge).toBeDisabled();
    await user.type(screen.getByLabelText("Incident action reason"), "Assigned to connector operations");
    expect(acknowledge).toBeEnabled();
    await user.click(acknowledge);
    await waitFor(() => expect(mock.actOnIncident).toHaveBeenCalledWith("INC-2026-000001", "acknowledge", 3, expect.any(Object)));
  });

  it("keeps monitor activation gated until reviewed evidence is complete", async () => {
    const mock = api();
    vi.mocked(mock.listTargets).mockResolvedValue([
      {
        id: "P14-M001",
        sourceId: "HKAPI-001",
        provider: "GovHK",
        outcome: "unknown",
        lastChecked: null,
        activation: "specified_pending_approval",
        publicVisibility: "pending_review",
        baselineVersion: null,
        version: 1,
      },
    ]);
    const user = userEvent.setup();
    render(<AdminApp api={mock} initialEntries={["/targets"]} />);
    const activate = await screen.findByRole("button", { name: "Activate monitor" });
    expect(activate).toBeDisabled();
    await screen.findByRole("option", { name: /P14-M001/ });
    await user.selectOptions(screen.getByLabelText("Monitor target"), "P14-M001");
    await user.type(screen.getByLabelText("Operator identity"), "local-operator");
    await user.type(screen.getByLabelText("Rule version"), "rules@1.0.0");
    await user.type(screen.getByLabelText("Evidence observation ID"), "OBS-BASE-0001");
    await user.type(screen.getByLabelText("Activation reason"), "Local evidence reviewed");
    expect(activate).toBeEnabled();
    await user.click(activate);
    await waitFor(() => expect(mock.activateTarget).toHaveBeenCalledOnce());
    expect(mock.activateTarget).toHaveBeenCalledWith(
      "P14-M001",
      1,
      expect.objectContaining({
        operator_identity: "local-operator",
        rule_version: "rules@1.0.0",
        public_visibility: "private",
      }),
    );
  });

  it("requires fixture and live-probe evidence before connector activation", async () => {
    const mock = api();
    const user = userEvent.setup();
    render(<AdminApp api={mock} initialEntries={["/sources/HKAPI-001"]} />);
    const activate = await screen.findByRole("button", { name: "Activate connector" });
    expect(activate).toBeDisabled();
    await user.type(screen.getByLabelText("Connector ID"), "CONN-P01-SG-01-V1");
    await user.type(screen.getByLabelText("Code version"), "1.0.0");
    await user.type(screen.getByLabelText("Reviewed HTTPS endpoint"), "https://data.gov.hk/api");
    await user.type(
      screen.getByLabelText("Passing fixture evidence URL"),
      "https://evidence.example/fixture",
    );
    expect(activate).toBeDisabled();
    await user.type(
      screen.getByLabelText("Reviewed live-probe evidence URL"),
      "https://evidence.example/probe",
    );
    await user.type(screen.getByLabelText("Activation reason"), "Fixture and probe reviewed");
    expect(activate).toBeEnabled();
    await user.click(activate);
    await waitFor(() => expect(mock.activateConnector).toHaveBeenCalledOnce());
    expect(mock.activateConnector).toHaveBeenCalledWith(
      "HKAPI-001",
      2,
      expect.objectContaining({
        source_group_id: "P01-SG-01",
        purpose: "connector-observation",
      }),
    );
  });
});
