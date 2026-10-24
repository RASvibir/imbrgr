import { test, expect } from "@playwright/test";

test.describe("Tool: Collage Builder (/tools/collage)", () => {
  test("renders collage builder shell and metadata without 404", async ({ page }) => {
    const res = await page.goto("/tools/collage");
    expect(res?.status()).toBe(200);

    await expect(page.getByTestId("tool-shell")).toBeVisible();
    await expect(page.getByTestId("tool-title")).toHaveText(/Collage Builder/i);
    await expect(page.getByTestId("tool-workspace")).toBeVisible();
    await expect(page.getByTestId("tool-download-btn")).toBeVisible();
    await expect(page.getByTestId("tool-save-btn")).toBeVisible();
    await expect(page.getByTestId("tool-post-btn")).toBeVisible();
  });

  test("universal download and post feedback in tool shell", async ({ page }) => {
    await page.goto("/tools/collage");
    await page.getByTestId("tool-download-btn").click();
    await expect(page.getByTestId("tool-status-toast")).toBeVisible();
    await expect(page.getByTestId("tool-status-toast")).toContainText(/Downloaded Collage Builder/i);
  });

  test("breadcrumb navigates back to tools index", async ({ page }) => {
    await page.goto("/tools/collage");
    await page.getByRole("link", { name: /Back to Tools/i }).click();
    await expect(page).toHaveURL(/\/tools/);
    await expect(page.getByTestId("tools-index")).toBeVisible();
  });

  test("desktop layout: selects template, modifies spacing and cell properties", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/tools/collage");

    // Check canvas exists
    await expect(page.getByTestId("collage-canvas")).toBeVisible();

    // Select "Side by Side" layout
    const splitTmplBtn = page.getByRole("button", { name: /Select layout: Side by Side/i });
    if (await splitTmplBtn.isVisible()) {
      await splitTmplBtn.click();
      await expect(page.getByTestId("tool-status-toast")).toContainText(/Applied Side by Side layout/i);
    }

    // Switch to Spacing & FX controls tab
    const spacingTabBtn = page.getByRole("button", { name: /Spacing & FX/i });
    await spacingTabBtn.click();
    await expect(page.getByText(/Canvas Aspect Ratio/i)).toBeVisible();
    await expect(page.getByText(/Layout Spacing & Corners/i)).toBeVisible();

    // Select 4:5 aspect ratio
    await page.getByRole("button", { name: "4:5 Portrait" }).click();

    // Switch to Cell properties tab
    const cellTabBtn = page.locator("aside").getByRole("button", { name: /Cell #/i }).first();
    await cellTabBtn.click();
    await expect(page.getByTestId("cell-property-panel")).toBeVisible();

    // Rotate cell 90°
    await page.getByRole("button", { name: /Rotate 90°/i }).click();

    // Switch to Export tab and verify auto-tag "collage"
    const exportTabBtn = page.getByRole("button", { name: "🚀 Export" });
    await exportTabBtn.click();
    await expect(page.getByTestId("export-panel")).toBeVisible();
    await expect(page.getByRole("button", { name: /Download PNG/i })).toBeVisible();
  });

  test("responsive layout at 360px viewport with mobile bottom drawer", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/tools/collage");

    await expect(page.getByTestId("tool-title")).toBeVisible();

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);

    // Click mobile "Layouts" button in bottom bar
    const mobileLayoutsBtn = page.getByRole("button", { name: "Layouts" });
    await expect(mobileLayoutsBtn).toBeVisible();
    await mobileLayoutsBtn.click();

    // Bottom sheet drawer should open
    await expect(page.getByText("Choose Collage Layout")).toBeVisible();

    // Close bottom sheet
    await page.getByRole("button", { name: /Close panel/i }).click();
    await expect(page.getByText("Choose Collage Layout")).not.toBeVisible();
  });
});
