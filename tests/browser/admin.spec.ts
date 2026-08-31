import { expect, test } from "@playwright/test";

test("operator can review a source and reach incident operations", async ({ page }) => {
  await page.goto("http://localhost:4173/");
  await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Source health" })).toBeVisible();
  await page.goto("http://localhost:4173/sources/HKAPI-033");
  await page.getByLabel("Decision reason").fill("Rights and retention evidence reviewed");
  await page.getByLabel("Evidence URL").fill("https://example.hk/terms");
  await page.getByRole("button", { name: "Approve source" }).click();
  await expect(page.getByRole("status")).toContainText("audit trail");
  await page.goto("http://localhost:4173/incidents");
  await expect(page.getByRole("heading", { name: "Incidents" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Acknowledge incident" })).toBeDisabled();
});

for (const width of [1440, 1024, 720, 390]) {
  test(`operator layout has no page overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    await page.goto("http://localhost:4173/");
    await expect(page.getByRole("heading", { name: "Operations overview" })).toBeVisible();
    expect(await page.evaluate(() => document.body.scrollWidth - document.documentElement.clientWidth)).toBe(0);
    if (width <= 720) {
      await page.getByRole("button", { name: "Toggle navigation" }).click();
      await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    }
  });
}
