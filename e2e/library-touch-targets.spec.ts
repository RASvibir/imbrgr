import { test, expect } from "@playwright/test";

/**
 * My Images overlay actions must be usable on touch: visible without hover and at least 44x44 CSS px.
 * (hasTouch + isMobile makes `(hover: none)` match in Chromium.)
 */
test.describe("library touch targets", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("image overlay actions are visible and 44px on touch", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/");
    const gen = await page.request.post("/api/ai/generate", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ prompt: `touch-targets ${Date.now()}`, visibility: "PUBLIC" }),
    });
    expect(gen.ok()).toBeTruthy();

    await page.goto("/library");
    await expect(page.getByTestId("my-images-panel")).toBeVisible();

    for (const name of ["Download image", "Copy link"]) {
      const btn = page.getByRole("button", { name }).first();
      await expect(btn).toBeVisible({ timeout: 10_000 });
      await expect(btn).toHaveCSS("opacity", "1"); // button itself
      const overlayOpacity = await btn.evaluate((el) => getComputedStyle(el.parentElement!).opacity);
      expect(overlayOpacity).toBe("1");
      const box = await btn.boundingBox();
      expect(box).toBeTruthy();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });
});
