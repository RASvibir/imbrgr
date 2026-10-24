import { test, expect } from "@playwright/test";

test.describe("Tool: Photo Filters (/tools/filters)", () => {
  test("renders photo filters shell and metadata without 404", async ({ page }) => {
    const res = await page.goto("/tools/filters");
    expect(res?.status()).toBe(200);

    await expect(page.getByTestId("tool-shell")).toBeVisible();
    await expect(page.getByTestId("tool-title")).toHaveText(/Photo Filters/i);
    await expect(page.getByTestId("tool-workspace")).toBeVisible();
    await expect(page.getByTestId("tool-download-btn")).toBeVisible();
    await expect(page.getByTestId("tool-save-btn")).toBeVisible();
    await expect(page.getByTestId("tool-post-btn")).toBeVisible();
  });

  test("universal download and post feedback in tool shell", async ({ page }) => {
    page.on("console", (msg) => console.log("CONSOLE:", msg.text()));
    page.on("pageerror", (err) => console.log("PAGE ERROR:", err));
    await page.goto("/tools/filters");
    await page.getByTestId("tool-download-btn").click();
    await expect(page.getByTestId("tool-status-toast")).toBeVisible();
    await expect(page.getByTestId("tool-status-toast")).toContainText(/Downloaded Photo Filters/i);
  });

  test("breadcrumb navigates back to tools index", async ({ page }) => {
    await page.goto("/tools/filters");
    await page.getByRole("link", { name: /Back to Tools/i }).click();
    await expect(page).toHaveURL(/\/tools/);
    await expect(page.getByTestId("tools-index")).toBeVisible();
  });

  test("responsive layout at 360px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/tools/filters");
    await expect(page.getByTestId("tool-title")).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
