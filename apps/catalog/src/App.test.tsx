import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { fixtureCatalogue } from "./test-fixtures";

describe("catalogue application", () => {
  it("opens permanent category pages and links category navigation", async () => {
    window.history.replaceState({}, "", "/categories/climate-weather/");
    const user = userEvent.setup();

    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    expect(screen.getByRole("heading", { name: "1 source" })).toBeVisible();
    expect(screen.getByRole("heading", { name: /observatory/i })).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Map Service" })).not.toBeInTheDocument();
    const weather = screen.getByRole("link", { name: "Weather" });
    expect(weather).toHaveAttribute("href", "/");
    expect(weather).toHaveAttribute("aria-current", "page");

    await user.click(weather);
    expect(screen.getByRole("heading", { name: "2 sources" })).toBeVisible();
    expect(window.location.pathname).toBe("/");
    expect(weather).toHaveAttribute("href", "/categories/climate-weather/");
  });

  it("shows the independent-project notice before catalogue results", () => {
    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    const notice = screen.getByText(/independent community project/i);
    const resource = screen.getByRole("heading", { name: /observatory/i });
    expect(notice.compareDocumentPosition(resource) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("makes the exact provider-resource browser discoverable from the catalogue", () => {
    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    expect(screen.getByRole("link", { name: /browse provider files and endpoints/i })).toHaveAttribute(
      "href",
      "/provider-resources/",
    );
  });

  it("searches, filters, switches locale and opens an internal detail", async () => {
    const user = userEvent.setup();
    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    await user.type(screen.getByRole("searchbox"), "天文台");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "繁中" }));
    expect(screen.getByRole("heading", { name: "香港天文台開放數據 API" })).toBeVisible();
    await user.click(screen.getByRole("link", { name: /查看來源/ }));
    expect(screen.getByText(/請先核對來源的現行條款/)).toBeVisible();
    expect(screen.getByRole("link", { name: /開啟供應者文件/ })).toHaveAttribute(
      "href",
      "https://www.hko.gov.hk/en/abouthko/opendata_intro.htm",
    );
    expect(screen.getByRole("heading", { name: "如何存取此來源" })).toBeVisible();
    expect(screen.getByRole("tab", { name: "Python" })).toBeVisible();
    expect(screen.getByRole("link", { name: "跳至存取指引" })).toHaveAttribute("href", "#access");
    expect(screen.getByRole("link", { name: "報告資料錯誤" })).toHaveAttribute(
      "href",
      expect.stringContaining("HKAPI-HKO"),
    );
  });

  it("uses source terminology and clears the search from the unified reset", async () => {
    const user = userEvent.setup();
    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    await user.type(screen.getByRole("searchbox"), "observatory");
    expect(screen.getByRole("heading", { name: "1 source" })).toBeVisible();
    expect(window.location.search).toBe("?q=observatory");
    expect(screen.getByRole("button", { name: "Download JSON" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Download CSV" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear all" }));
    expect(screen.getByRole("heading", { name: "2 sources" })).toBeVisible();
    expect(screen.getByRole("searchbox")).toHaveValue("");
  });
});
