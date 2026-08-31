import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  forbidOnly: true,
  retries: 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:4175/hk-open-data/",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: [
    {
      command: "pnpm --filter @hk-open-data/admin dev --port 4173",
      url: "http://127.0.0.1:4173/",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @hk-open-data/portal dev",
      url: "http://127.0.0.1:4174/",
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: "pnpm --filter @hk-open-data/catalog build && pnpm --filter @hk-open-data/catalog exec vite preview --host 127.0.0.1 --port 4175",
      url: "http://127.0.0.1:4175/hk-open-data/",
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
