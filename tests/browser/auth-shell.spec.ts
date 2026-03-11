import { expect, test } from "@playwright/test";

test.describe("auth shell", () => {
  test("protected routes redirect anonymous users to local sign-in", async ({ page }) => {
    const protectedRoutes = ["/organisation", "/dashboard", "/organisation/projects/new"];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/sign-in\?redirect_url=/);
      await expect(
        page.getByText(/ai assistant workspace/i),
      ).toBeVisible();
    }
  });

  test("sign-in page exposes auth entry points and legal links", async ({ page }) => {
    await page.goto("/sign-in");

    await expect(
      page.getByText(/ai assistant workspace/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign up$/i })).toBeVisible();
    await expect(page.locator("#clerk-captcha")).toHaveCount(1);

    await expect(
      page.getByRole("link", { name: "Privacy Policy" }),
    ).toHaveAttribute("href", "/privacy");
    await expect(
      page.getByRole("link", { name: "Terms of Service" }),
    ).toHaveAttribute("href", "/terms");
  });

  test("sign-up page exposes conversion path back to sign-in", async ({ page }) => {
    await page.goto("/sign-up");

    await expect(
      page.getByText(/ai assistant workspace/i),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /^sign up$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /^log in$/i })).toBeVisible();
    await expect(page.locator("#clerk-captcha")).toHaveCount(1);
  });

  test("sign-in page legal links are navigable", async ({ page }) => {
    await page.goto("/sign-in");

    await page.getByRole("link", { name: "Privacy Policy" }).click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeVisible();

    await page.goto("/sign-in");
    await page.getByRole("link", { name: "Terms of Service" }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await expect(
      page.getByRole("heading", { name: "Terms of Service" }),
    ).toBeVisible();
  });
});
