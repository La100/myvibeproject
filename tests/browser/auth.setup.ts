import { expect, test } from "@playwright/test";

const AUTH_STATE_PATH = "playwright/.auth/user.json";

test("bootstrap authenticated Clerk session", async ({ page }) => {
  test.setTimeout(60_000);

  await page.goto("/auth/e2e-login?redirectTo=/dashboard");
  await page.waitForURL(/\/organisation|\/onboarding/, { timeout: 60_000 });

  await page.context().storageState({ path: AUTH_STATE_PATH });
});
