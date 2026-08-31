import { expect, test } from "@playwright/test";

test("public visitor sees reviewed status and can switch language", async ({ page }) => {
  await page.goto("http://localhost:4174/");
  await expect(page.getByRole("heading", { name: "Public data status" })).toBeVisible();
  await expect(page.getByText(/not provider endorsement/i)).toBeVisible();
  await expect(page.getByRole("table", { name: "Current incidents" })).toBeVisible();
  await page.getByRole("button", { name: "繁體中文" }).click();
  await expect(page.getByRole("heading", { name: "公共數據狀態" })).toBeVisible();
});

for (const width of [1440, 1024, 720, 390]) {
  test(`public layout preserves order and width at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("http://localhost:4174/");
    await expect(page.getByRole("heading", { name: "Public data status" })).toBeVisible();
    expect(await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    expect(await page.locator('[data-testid^="public-section"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-section")))).toEqual(["summary", "notice", "incidents", "sources"]);
  });
}
