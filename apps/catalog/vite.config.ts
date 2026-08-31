import { resolve } from "node:path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  base: "/hk-open-data/",
  plugins: [react()],
  publicDir: resolve(import.meta.dirname, "../../catalog/generated"),
  test: {
    environment: "jsdom",
    setupFiles: "./src/test-setup.ts",
  },
});
