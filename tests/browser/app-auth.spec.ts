import { expect, test } from "@playwright/test";

test("signed-in user can create a real project in the workspace", async ({ page }) => {
  test.setTimeout(120_000);

  const projectName = `E2E Project ${Date.now()}`;

  await page.goto("/organisation/projects/new");
  await expect(page.getByLabel(/project name/i)).toBeVisible({ timeout: 60_000 });

  await page.getByLabel(/project name/i).fill(projectName);
  await page.getByRole("button", { name: /^create project$/i }).click();

  const projectLimitDialog = page.getByText(/project limit reached/i);
  if (await projectLimitDialog.isVisible().catch(() => false)) {
    throw new Error("Project creation is blocked by the current subscription project limit");
  }

  await page.waitForURL(/\/organisation\/projects\/[^/]+$/, { timeout: 60_000 });
  await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible({
    timeout: 60_000,
  });
});
