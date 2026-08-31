import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { App } from "./App";
import { fixtureCatalogue } from "./test-fixtures";

describe("catalogue application", () => {
  it("shows the independent-project notice before catalogue results", () => {
    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    const notice = screen.getByText(/independent community project/i);
    const resource = screen.getByRole("heading", { name: /observatory/i });
    expect(notice.compareDocumentPosition(resource) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("searches, filters, switches locale and opens an internal detail", async () => {
    const user = userEvent.setup();
    render(<App catalogue={fixtureCatalogue} initialLocale="en" />);

    await user.type(screen.getByRole("searchbox"), "天文台");
    expect(screen.getAllByRole("article")).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "繁中" }));
    expect(screen.getByRole("heading", { name: "香港天文台開放數據 API" })).toBeVisible();
    await user.click(screen.getByRole("link", { name: /查看資源/ }));
    expect(screen.getByText(/上游條款永遠優先/)).toBeVisible();
    expect(screen.getByRole("link", { name: /開啟供應者文件/ })).toHaveAttribute(
      "href",
      "https://www.hko.gov.hk/en/abouthko/opendata_intro.htm",
    );
  });
});
