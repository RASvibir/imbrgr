import { test, expect } from "@playwright/test";

const artifactsDir = "/opt/cursor/artifacts/screenshots";

test.describe("home hero polish", () => {
  test("ember mark visible without covering prompt — mobile and desktop", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.getByTestId("ember-hero-mark")).toBeVisible();
    await expect(page.getByTestId("home-studio-prompt")).toBeVisible();
    await page.screenshot({ path: `${artifactsDir}/home-hero-polish-390.png`, fullPage: false });

    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await expect(page.getByTestId("ember-hero-mark")).toBeVisible();
    await expect(page.getByTestId("home-studio-prompt")).toBeVisible();
    await page.screenshot({ path: `${artifactsDir}/home-hero-polish-1280.png`, fullPage: false });
  });

  test("404 shows ember empty state", async ({ page }) => {
    await page.goto("/this-route-does-not-exist-imbrgr");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(page.getByTestId("ember-hero-mark")).toBeVisible();
    await expect(page.getByRole("link", { name: /Back to gallery/i })).toBeVisible();
  });
});
