import { expect, test } from "@playwright/test";

test.describe("public marketing and support pages", () => {
  test("landing page renders hero and primary navigation", async ({ page, isMobile }) => {
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: /your projects deserve a smarter workflow/i,
      }),
    ).toBeVisible();
    await expect(
      page.getByText(/one ai workspace for architectural teams/i),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /start planning free/i }),
    ).toBeVisible();

    if (isMobile) {
      await expect(
        page.getByRole("button", { name: /open navigation/i }),
      ).toBeVisible();
      return;
    }

    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Features" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "Pricing" }),
    ).toBeVisible();
    await expect(
      page.getByRole("navigation").getByRole("link", { name: "FAQ" }),
    ).toBeVisible();
  });

  test("mobile navigation exposes key entry points", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile nav exists only on small viewport layout");

    await page.goto("/");
    await page.getByRole("button", { name: /open navigation/i }).click();

    await expect(page.getByRole("link", { name: "Features" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Pricing" })).toBeVisible();
    await expect(page.getByRole("link", { name: "FAQ" })).toBeVisible();
    await expect(
      page.getByRole("link", { name: /get started/i }),
    ).toBeVisible();
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible();
  });

  test("help, privacy and terms pages render stable content", async ({ page }) => {
    await page.goto("/help");
    await expect(page.getByRole("heading", { name: "Help" })).toBeVisible();
    await expect(page.getByText(/coming soon/i)).toBeVisible();

    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" }),
    ).toBeVisible();
    await expect(page.getByText(/last updated:/i)).toBeVisible();
    await expect(
      page.getByRole("link", { name: "privacy@myvibeproject.com" }),
    ).toHaveAttribute("href", "mailto:privacy@myvibeproject.com");

    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: "Terms of Service" }),
    ).toBeVisible();
    await expect(
      page.getByText(/welcome to myvibe project/i),
    ).toBeVisible();
  });
});
