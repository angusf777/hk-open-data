// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppShell, Button, DataTable, StatusLabel } from "./index.js";

describe("shared civic UI", () => {
  it("exposes accessible named controls and visible keyboard focus styling", () => {
    const action = vi.fn();
    render(<Button onClick={action}>Review source</Button>);
    fireEvent.click(screen.getByRole("button", { name: "Review source" }));
    expect(action).toHaveBeenCalledOnce();
    expect(screen.getByRole("button")).toHaveClass("ui-button");
  });

  it("communicates status with icon and text rather than colour alone", () => {
    render(<StatusLabel tone="healthy">Healthy</StatusLabel>);
    expect(screen.getByText("Healthy")).toBeVisible();
    expect(screen.getByText("Healthy").parentElement).toHaveAttribute("data-tone", "healthy");
  });

  it("retains semantic headers and labelled mobile cells", () => {
    render(
      <DataTable
        caption="Source health"
        rowKey={(row) => row.id}
        columns={[
          { key: "source", label: "Source", render: (row) => row.source },
          { key: "state", label: "State", render: (row) => row.state },
        ]}
        rows={[{ id: "one", source: "DATA.GOV.HK", state: "Healthy" }]}
      />,
    );
    expect(screen.getByRole("table", { name: "Source health" })).toBeVisible();
    expect(screen.getByRole("columnheader", { name: "Source" })).toBeVisible();
    expect(screen.getByText("DATA.GOV.HK").closest("td")).toHaveAttribute("data-label", "Source");
  });

  it("provides named navigation and a mobile menu control", () => {
    render(
      <AppShell
        product="HK Open Data Runtime"
        environment="Self-hosted"
        navigation={[{ label: "Overview", href: "/", icon: "overview" }]}
      >
        <h1>Operations overview</h1>
      </AppShell>,
    );
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Toggle navigation" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  });
});
