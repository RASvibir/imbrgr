import { test, expect } from "@playwright/test";

test.describe("Tool: AR Camera (/tools/ar)", () => {
  test("renders AR camera shell, metadata, and privacy note without 404", async ({ page }) => {
    const res = await page.goto("/tools/ar");
    expect(res?.status()).toBe(200);

    await expect(page).toHaveTitle(/AR Camera/i);
    await expect(page.getByTestId("tool-shell")).toBeVisible();
    await expect(page.getByTestId("tool-title")).toHaveText(/AR Camera/i);
    await expect(page.getByTestId("tool-workspace")).toBeVisible();

    // Verify on-device privacy note
    await expect(page.getByText(/100% On-Device Privacy/i)).toBeVisible();

    // Verify start camera button and fallback photo upload button
    await expect(page.getByTestId("start-camera-button")).toBeVisible();
    await expect(page.getByRole("button", { name: /Upload a Photo Instead/i })).toBeVisible();

    // Verify universal action buttons in tool shell
    await expect(page.getByTestId("tool-download-btn")).toBeVisible();
    await expect(page.getByTestId("tool-save-btn")).toBeVisible();
    await expect(page.getByTestId("tool-post-btn")).toBeVisible();
  });

  test("effect picker rail displays procedural AR effects and updates intensity", async ({ page }) => {
    await page.goto("/tools/ar");

    // Check initial active effect button
    const burgerHatBtn = page.getByTestId("effect-btn-burger-hat");
    await expect(burgerHatBtn).toBeVisible();
    await expect(burgerHatBtn).toHaveAttribute("aria-checked", "true");

    // Click another effect: Cheese Drip
    const cheeseMeltBtn = page.getByTestId("effect-btn-cheese-melt");
    await expect(cheeseMeltBtn).toBeVisible();
    await cheeseMeltBtn.click();
    await expect(cheeseMeltBtn).toHaveAttribute("aria-checked", "true");
    await expect(burgerHatBtn).toHaveAttribute("aria-checked", "false");

    // Check Grill Vision (fun filter) reveals dropdown selector
    const funFilterBtn = page.getByTestId("effect-btn-fun-filter");
    await expect(funFilterBtn).toBeVisible();
    await funFilterBtn.click();
    await expect(funFilterBtn).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(/Choose Fun Filter Flavor/i)).toBeVisible();

    // Verify intensity slider interaction
    const intensitySlider = page.locator("#intensity-range");
    await expect(intensitySlider).toBeVisible();
    await intensitySlider.fill("0.5");
    await expect(page.getByText("50%")).toBeVisible();
  });

  test("timer countdown toggle switches between Off and 3s", async ({ page }) => {
    await page.goto("/tools/ar");

    const offBtn = page.getByRole("button", { name: "Off" });
    const threeSecBtn = page.getByRole("button", { name: "3s" });

    await expect(offBtn).toBeVisible();
    await expect(threeSecBtn).toBeVisible();

    await threeSecBtn.click();
    await expect(threeSecBtn).toHaveClass(/bg-\[var\(--accent-primary\)\]/);

    await offBtn.click();
    await expect(offBtn).toHaveClass(/bg-\[var\(--accent-primary\)\]/);
  });

  test("universal download and post feedback in tool shell", async ({ page }) => {
    await page.goto("/tools/ar");

    const downloadBtn = page.getByTestId("tool-download-btn");
    await expect(downloadBtn).toBeVisible();
    await downloadBtn.click();

    const toast = page.getByTestId("tool-status-toast");
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Downloaded AR Camera/i);
  });

  test("breadcrumb navigates back to tools index", async ({ page }) => {
    await page.goto("/tools/ar");
    await page.getByRole("link", { name: /Back to Tools/i }).click();
    await expect(page).toHaveURL(/\/tools/);
    await expect(page.getByTestId("tools-index")).toBeVisible();
  });

  test("responsive layout test on mobile 360px viewport without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const res = await page.goto("/tools/ar");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("tool-title")).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
