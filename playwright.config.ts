import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  globalSetup: "./e2e/global-setup.ts",
  testDir: "e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      AI_MOCK: "true",
      UPLOAD_RATE_LIMIT_PER_HOUR: "10000",
      AI_RATE_LIMIT_PER_HOUR: "10000",
      AUTH_SECRET: "e2e-test-secret",
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://imbrgr:imbrgr@localhost:5432/imbrgr?schema=public",
      DATABASE_URL_UNPOOLED: process.env.DATABASE_URL_UNPOOLED ?? "postgresql://imbrgr:imbrgr@localhost:5432/imbrgr?schema=public",
      NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3000",
      SUPERADMIN_USERNAMES: "e2eadmin,vibir",
      STORAGE_DRIVER: "local",
    },
  },
});
