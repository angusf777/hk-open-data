import { expect, test } from "@playwright/test";

test("search, locale and resource permalink work without provider traffic", async ({ page }) => {
  const outsideRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (!new Set(["127.0.0.1", "localhost"]).has(hostname)) outsideRequests.push(request.url());
  });

  await page.goto("./");
  await expect(page.getByText("Independent community project. Upstream terms always control.")).toBeVisible();
  await page.getByRole("searchbox").fill("DATA.GOV.HK CKAN package list");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "繁中" }).click();
  await expect(page.getByText("獨立社群項目。上游條款永遠優先。")).toBeVisible();
  await page.getByRole("link", { name: "查看資源" }).click();
  await expect(page).toHaveURL(/resources\/official%3Ahkapi-001\/$/i);
  await expect(page.getByText(/本項目記錄證據，而非授予許可/)).toBeVisible();
  expect(outsideRequests).toEqual([]);
});

test("static detail permalink loads directly", async ({ page }) => {
  await page.goto("resources/official%3Ahkapi-001/");
  await expect(
    page.getByRole("heading", { level: 1, name: "DATA.GOV.HK CKAN package list" }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://angusf777.github.io/hk-open-data/resources/official%3Ahkapi-001/",
  );
});

test("mobile catalogue reflows without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.locator(".filters > summary")).toContainText("Filter resources");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
