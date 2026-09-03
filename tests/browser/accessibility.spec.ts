import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("catalogue and detail page have no automated accessibility violations", async ({ page }) => {
  await page.goto("./");
  const catalogueResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(catalogueResults.violations).toEqual([]);

  await page.getByRole("searchbox").fill("DATA.GOV.HK CKAN package list");
  await page.getByRole("link", { name: "View resource" }).click();
  const detailResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(detailResults.violations).toEqual([]);

  await page.goto("provider-resources/");
  await expect(page.getByRole("heading", { level: 1, name: "Browse exact provider resources" })).toBeVisible();
  const providerResourcesResults = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(providerResourcesResults.violations).toEqual([]);
});
