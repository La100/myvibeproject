import { defineConfig, devices } from "@playwright/test";

const PORT = 3101;
const BASE_URL = `http://localhost:${PORT}`;
const AUTH_STATE_PATH = "playwright/.auth/user.json";
const baseUse = {
  baseURL: BASE_URL,
  trace: "retain-on-failure" as const,
  screenshot: "only-on-failure" as const,
  video: "retain-on-failure" as const,
};

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  use: baseUse,
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: baseUse,
    },
    {
      name: "app-chromium",
      testMatch: /app-auth\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        ...baseUse,
        storageState: AUTH_STATE_PATH,
      },
    },
  ],
  webServer: {
    command: `E2E_AUTH_BYPASS=1 E2E_AUTH_BYPASS_ALLOW_PRODUCTION=1 pnpm exec next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
