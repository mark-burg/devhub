import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run the built site (dist/) under a /devhub/ sub-path — exactly how GitHub
// Pages serves a project site — layered over demo content seeded into e2e/.data.
// `npm run test:e2e` builds, seeds (once) and runs all browsers.

const PORT = 4180;

export default defineConfig({
  testDir: "e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }], ["json", { outputFile: "playwright-report/results.json" }]]
    : [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}/devhub/`,
    trace: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], permissions: ["clipboard-read", "clipboard-write"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
  webServer: {
    command: `node scripts/serve.mjs dist e2e/.data --port ${PORT} --prefix /devhub/`,
    url: `http://localhost:${PORT}/devhub/`,
    reuseExistingServer: !process.env.CI,
  },
});
