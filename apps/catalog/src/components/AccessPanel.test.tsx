import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AccessPanel } from "./AccessPanel";
import type { AccessRecipe } from "../types";

const recipe: AccessRecipe = {
  schemaVersion: 1,
  sourceReference: "HKAPI-001",
  recipeVersion: "1.0.0",
  adapter: "rest-json",
  status: "fixture-tested",
  effectiveStatus: "fixture-tested",
  documentationUrl: "https://example.com/docs",
  limitations: ["Technical example only."],
  authentication: { type: "none", environmentVariables: [], setup: null },
  request: {
    method: "GET",
    urlTemplate: "https://example.com/data",
    allowedHosts: ["example.com"],
    parameters: [
      {
        name: "limit",
        location: "query",
        dataType: "integer",
        required: false,
        default: 10,
        example: 10,
        description: "Maximum records.",
        enum: [],
        minimum: 1,
        maximum: 100,
        pattern: null,
      },
    ],
    headers: [],
    bodyTemplate: null,
    timeoutMs: 15000,
    maxResponseBytes: 1048576,
    maxPages: 1,
    retry: { attempts: 2, statusCodes: [429, 500] },
  },
  response: {
    mediaTypes: ["application/json"],
    recordPath: "/result",
    idPath: null,
    timestampPath: null,
    pagination: { strategy: "none", nextPath: null },
    normalization: { fields: {}, language: null, geometry: null, timestamp: null },
  },
  reason: null,
  nextAction: null,
  recipeSha256: "a".repeat(64),
  examples: {
    curl: "curl https://example.com/data?limit=10",
    python: "import httpx\nhttpx.get('https://example.com/data')",
    typescript: "await fetch('https://example.com/data');",
  },
  verification: null,
};

describe("AccessPanel", () => {
  it("shows copyable examples and the permission boundary without executing them", async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<AccessPanel locale="en" recipe={recipe} />);

    expect(screen.getByText("Fixture tested")).toBeVisible();
    expect(screen.getByRole("tab", { name: "Python" })).toBeVisible();
    expect(screen.getByText(/does not grant permission/i)).toBeVisible();
    expect(fetchSpy).not.toHaveBeenCalled();

    await user.click(screen.getByRole("tab", { name: "Python" }));
    await user.click(screen.getByRole("button", { name: "Copy Python example" }));
    expect(writeText).toHaveBeenCalledWith(recipe.examples.python);
    expect(screen.getByRole("status")).toHaveTextContent("Python example copied");
  });

  it("links DATA.GOV.HK recipes to the public provider-resource inventory", () => {
    render(
      <AccessPanel
        locale="en"
        recipe={{ ...recipe, adapter: "data-gov-resource-index" }}
      />,
    );

    expect(screen.getByRole("link", { name: /browse exact provider resources/i })).toHaveAttribute(
      "href",
      "/provider-resources/?source=HKAPI-001",
    );
  });
});
