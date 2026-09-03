import { expect, test } from "@playwright/test";

test("search, locale and resource permalink work without automatic external requests", async ({ page }) => {
  const outsideRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (!new Set(["127.0.0.1", "localhost"]).has(hostname)) outsideRequests.push(request.url());
  });

  await page.goto("./");
  await expect(page.getByText("Independent community project. Check each source's current terms before use.")).toBeVisible();
  await page.getByRole("searchbox").fill("DATA.GOV.HK CKAN package list");
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "繁中" }).click();
  await expect(page.getByText("獨立社群項目。使用每項資源前，請先核對來源的現行條款。")).toBeVisible();
  await page.getByRole("link", { name: "查看資源" }).click();
  await expect(page).toHaveURL(/resources\/official%3Ahkapi-001\/$/i);
  await expect(page.getByText(/這項日期化查核不會授予使用權/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "如何存取此來源" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Python" })).toBeVisible();
  expect(outsideRequests).toEqual([]);
});

test("filters official resources by their generated access status", async ({ page }) => {
  await page.goto("./");
  await page.getByLabel("Has executable recipe").check();
  await expect(page.getByRole("heading", { name: "227 resources" })).toBeVisible();

  await page.getByLabel("Live verified").check();
  await expect(page.getByRole("heading", { name: "219 resources" })).toBeVisible();

  await page.getByLabel("No automated access").check();
  await expect(page.getByRole("heading", { name: "38 resources" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(10);
});

test("shows ten resources before the user asks for more", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("article")).toHaveCount(10);

  await page.getByRole("button", { name: /Show more resources/ }).click();
  await expect(page.getByRole("article")).toHaveCount(30);
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

test("provider-resource browser searches exact endpoints and generates parameterized usage locally", async ({ page }) => {
  const outsideRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (!new Set(["127.0.0.1", "localhost"]).has(hostname)) outsideRequests.push(request.url());
  });

  await page.goto("provider-resources/?source=HKAPI-076");
  await expect(page.getByRole("heading", { level: 1, name: "Browse exact provider resources" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2, name: "1 resource" })).toBeVisible();

  const historical = page.getByRole("article", {
    name: "Flight schedule information of Hong Kong International Airport (Historical).",
  }).first();
  await historical.getByRole("button", { name: "View usage" }).click();
  await expect(historical.getByRole("button", { name: "Copy command" })).toBeDisabled();
  await historical.getByLabel("date").fill("2026-09-02");
  await historical.getByRole("tab", { name: "hkdata" }).click();
  await expect(historical.locator("pre")).toContainText("hkdata fetch-resource HKAPI-076");
  await expect(historical.locator("pre")).toContainText("--param date=2026-09-02");
  expect(outsideRequests).toEqual([]);
});

test("provider-resource browser reflows without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("provider-resources/");
  await expect(page.getByRole("heading", { level: 1, name: "Browse exact provider resources" })).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(20);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("mobile catalogue reflows without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("./");
  await expect(page.getByRole("searchbox")).toBeVisible();
  await expect(page.locator(".filters > summary")).toContainText("Filter resources");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
