import { test, expect } from "@playwright/test";

test.describe("Tool: Meme Maker (/tools/meme)", () => {
  test("renders meme maker shell and metadata without 404", async ({ page }) => {
    const res = await page.goto("/tools/meme");
    expect(res?.status()).toBe(200);

    await expect(page).toHaveTitle(/Meme Maker/i);
    await expect(page.getByTestId("tool-shell")).toBeVisible();
    await expect(page.getByTestId("tool-title")).toHaveText(/Meme Maker/i);

    // Canvas stage and workspace are visible
    await expect(page.getByTestId("tool-workspace")).toBeVisible();
    await expect(page.getByTestId("meme-canvas")).toBeVisible();
  });

  test("loads desktop editor, selects template, customizes text, and views export panel", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const res = await page.goto("/tools/meme");
    expect(res?.status()).toBe(200);

    // Check header and core canvas stage
    await expect(page.getByRole("heading", { name: "Meme Maker" })).toBeVisible();
    await expect(page.getByTestId("meme-canvas")).toBeVisible();
    const desktopSidebar = page.getByTestId("tool-desktop-sidebar");
    await expect(desktopSidebar).toBeVisible();

    // Verify initial default layers (Top Text & Bottom Text) in desktop sidebar
    await desktopSidebar.getByRole("button", { name: /Layers/i }).click();
    const layerList = desktopSidebar.getByRole("list", { name: "Canvas Layers" });
    await expect(layerList).toBeVisible();
    await expect(layerList.getByText("Top Text", { exact: true })).toBeVisible();
    await expect(layerList.getByText("Bottom Text", { exact: true })).toBeVisible();

    // Switch to Formats / Templates tab and select a built-in original template
    await desktopSidebar.getByRole("button", { name: /Formats/i }).click();
    await expect(desktopSidebar.getByText("Original Meme Formats").first()).toBeVisible();

    const twoButtonsTmpl = desktopSidebar.getByRole("button", { name: /Use template: Two Buttons/i });
    await expect(twoButtonsTmpl).toBeVisible();
    await twoButtonsTmpl.click();

    // After selecting Two Buttons, verify property panel opens with Top Choice text layer
    await expect(desktopSidebar.getByLabel("Text layer content")).toBeVisible();
    await desktopSidebar.getByLabel("Text layer content").fill("WHEN YOU CODE CLEAN APPS");

    // Add a sticker
    const addStickerBtn = desktopSidebar.getByRole("button", { name: "+ Sticker" });
    await addStickerBtn.click();
    await expect(desktopSidebar.getByText("Select Emoji")).toBeVisible();

    // Add a speech bubble
    const addBubbleBtn = desktopSidebar.getByRole("button", { name: "+ Bubble" });
    await addBubbleBtn.click();
    await expect(desktopSidebar.getByText("Shape Type")).toBeVisible();

    // Open Export tab and verify export panel and action buttons
    const exportTabButton = desktopSidebar.getByRole("button", { name: "Export", exact: true });
    await exportTabButton.click();
    await expect(desktopSidebar.getByTestId("export-panel")).toBeVisible();

    const downloadBtn = page.getByTestId("tool-download-btn").or(desktopSidebar.getByRole("button", { name: /Download/i }));
    await expect(downloadBtn.first()).toBeVisible();

    const postBtn = page.getByTestId("tool-post-btn").or(desktopSidebar.getByRole("button", { name: /Post to.*Gallery/i }));
    await expect(postBtn.first()).toBeVisible();
  });

  test("breadcrumb navigates back to tools index", async ({ page }) => {
    await page.goto("/tools/meme");
    await page.getByRole("link", { name: /Back to Tools/i }).click();
    await expect(page).toHaveURL(/\/tools/);
    await expect(page.getByTestId("tools-index")).toBeVisible();
  });

  test("responsive mobile layout (375px) displays bottom thumb toolbar and bottom-sheet drawers", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/tools/meme");

    // Canvas must be visible
    await expect(page.getByTestId("meme-canvas")).toBeVisible();

    // Desktop sidebar must be hidden on mobile
    await expect(page.getByTestId("tool-desktop-sidebar")).toBeHidden();

    // Bottom mobile thumb toolbar buttons
    const formatsBtn = page.getByRole("button", { name: "Formats" });
    await expect(formatsBtn).toBeVisible();

    // Tap Formats to open mobile drawer
    await formatsBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("Original Meme Formats").first()).toBeVisible();

    // Close drawer
    await page.getByLabel("Close panel").click();
    await expect(page.getByRole("dialog")).toBeHidden();

    // Tap Export to open mobile export drawer
    const exportBtn = page.locator(".sticky.bottom-0").getByRole("button", { name: /Export/i });
    await exportBtn.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByTestId("export-panel")).toBeVisible();
    await expect(page.getByRole("button", { name: /Download/i })).toBeVisible();
  });

  test("responsive layout test on mobile 360px viewport without overflow", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    const res = await page.goto("/tools/meme");
    expect(res?.status()).toBe(200);
    await expect(page.getByTestId("tool-title")).toBeVisible();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
