import { test, expect } from "@playwright/test";

test.describe("create hub", () => {
  test("nav points at /create and the hub links to the image studio", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Create", exact: true })).toHaveAttribute("href", "/create");

    await page.goto("/create");
    await expect(page.getByTestId("create-hub")).toBeVisible();
    await expect(page.getByTestId("create-card-video").getByRole("link")).toHaveAttribute("href", "/studio?tab=video");
    await expect(page.getByTestId("create-card-fun")).toBeVisible();

    await page.getByTestId("create-card-image").getByRole("link").click();
    await expect(page).toHaveURL(/\/studio/);
  });
});
