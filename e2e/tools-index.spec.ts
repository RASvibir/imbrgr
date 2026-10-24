import { test, expect } from "@playwright/test";

test.describe("Tools Index Directory (/tools)", () => {
  test("loads tools directory and displays tools grid", async ({ page }) => {
    await page.goto("/tools");
    await expect(page.getByTestId("tools-index")).toBeVisible();
    await expect(page.getByTestId("tools-search-input")).toBeVisible();
    await expect(page.getByTestId("tools-category-tabs")).toBeVisible();

    // Verify key tool cards are present
    await expect(page.getByTestId("tool-card-meme")).toBeVisible();
    await expect(page.getByTestId("tool-card-gif")).toBeVisible();
    await expect(page.getByTestId("tool-card-collage")).toBeVisible();
    await expect(page.getByTestId("tool-card-filters")).toBeVisible();
    await expect(page.getByTestId("tool-card-ar")).toBeVisible();
  });

  test("filters tools by category tab", async ({ page }) => {
    await page.goto("/tools");
    await page.getByTestId("tools-category-tab-gif").click();

    await expect(page.getByTestId("tool-card-gif")).toBeVisible();
    await expect(page.getByTestId("tool-card-meme")).toBeHidden();
  });

  test("filters tools by search query", async ({ page }) => {
    await page.goto("/tools");
    await page.getByTestId("tools-search-input").fill("MediaPipe");

    await expect(page.getByTestId("tool-card-ar")).toBeVisible();
    await expect(page.getByTestId("tool-card-meme")).toBeHidden();

    // Clear search
    await page.getByRole("button", { name: /Clear search query/i }).click();
    await expect(page.getByTestId("tool-card-meme")).toBeVisible();
  });

  test("shows empty state when no tools match search", async ({ page }) => {
    await page.goto("/tools");
    await page.getByTestId("tools-search-input").fill("nonexistentqueryxyz123");

    await expect(page.getByTestId("tools-empty-state")).toBeVisible();
    await page.getByRole("button", { name: /Clear search & filters/i }).click();
    await expect(page.getByTestId("tool-card-meme")).toBeVisible();
  });

  test("clicking tool card CTA navigates to tool page", async ({ page }) => {
    await page.goto("/tools");
    await page.getByTestId("tool-link-meme").click();
    await expect(page).toHaveURL(/\/tools\/meme/);
    await expect(page.getByTestId("tool-shell")).toBeVisible();
  });
});

test.describe("Home Page Tool Grid Integration", () => {
  test("renders tool grid on home landing page with popular tools row", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-tools-grid")).toBeVisible();
    await expect(page.getByTestId("home-popular-tools-row")).toBeVisible();
    await expect(page.getByTestId("home-see-all-tools")).toHaveAttribute("href", "/tools");

    // Click launch on a popular tool
    await page.getByTestId("home-launch-meme").click();
    await expect(page).toHaveURL(/\/tools\/meme/);
  });
});
