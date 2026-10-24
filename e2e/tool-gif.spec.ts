import { test, expect } from "@playwright/test";

test.describe("Tool: GIF Maker (/tools/gif)", () => {
  test("renders GIF maker shell, controls, and welcome input options", async ({ page }) => {
    const res = await page.goto("/tools/gif");
    expect(res?.status()).toBe(200);

    // Shell & Title
    await expect(page).toHaveTitle(/GIF Maker/);
    await expect(page.getByTestId("tool-shell")).toBeVisible();
    await expect(page.getByTestId("tool-title")).toHaveText(/GIF Maker/i);

    // Breadcrumb
    const backBtn = page.getByRole("link", { name: /Back to Tools/i });
    await expect(backBtn).toBeVisible();
    await expect(backBtn).toHaveAttribute("href", "/tools");

    // History and Zoom toolbar controls
    await expect(page.getByRole("button", { name: "Undo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Redo" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zoom out" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Zoom in" })).toBeVisible();

    // Welcome dropzone and media inputs
    await expect(page.getByText("imbrgr GIF Maker")).toBeVisible();
    await expect(page.getByText(/Upload Video/i).first()).toBeVisible();
    await expect(page.getByText(/Image Sequence/i).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Webcam/i }).first()).toBeVisible();
    await expect(page.getByText(/Import.*GIF/i).first()).toBeVisible();

    // Sidebar navigation tabs
    await expect(page.getByRole("button", { name: /Timeline/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Crop/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Captions/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Filters/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Quality/i }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Export/i }).first()).toBeVisible();
  });

  test("universal export options and actions are accessible", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/tools/gif");

    // Open Export tab or view export panel
    const exportBtn = page.getByRole("button", { name: /Export/i }).first();
    await exportBtn.click();

    const downloadBtn = page.getByTestId("tool-download-btn").or(page.getByRole("button", { name: /Download|Export/i }));
    await expect(downloadBtn.first()).toBeVisible();
  });

  test("breadcrumb navigates back to tools index", async ({ page }) => {
    await page.goto("/tools/gif");
    await page.getByRole("link", { name: /Back to Tools/i }).click();
    await expect(page).toHaveURL(/\/tools/);
    await expect(page.getByTestId("tools-index")).toBeVisible();
  });

  test("responsive layout at 360px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/tools/gif");
    await expect(page.getByTestId("tool-title")).toBeVisible();

    // Mobile toolbar buttons are visible
    await expect(page.getByRole("button", { name: /Trim/i })).toBeVisible();

    // Check no horizontal scroll overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
