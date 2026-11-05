import { defineConfig } from "@playwright/test";

// One worker: each test launches its own Chromium with the extension loaded.
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
});
