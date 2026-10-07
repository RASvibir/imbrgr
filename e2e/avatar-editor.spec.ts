import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");
const artifactsDir = "/opt/cursor/artifacts/screenshots";
const DESKTOP = { width: 1280, height: 800 };

async function signInE2E(page: import("@playwright/test").Page) {
  await page.goto("/auth/signin");
  await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
  await page.getByPlaceholder(/password/i).fill("password12345");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });
}

test.describe("avatar editor @ desktop", () => {
  test.use({ viewport: DESKTOP });

  test("upload, filter preview, undo, save", async ({ page }) => {
    test.setTimeout(180_000);
    await signInE2E(page);
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();

    const avatarInput = page.locator('label:has-text("Avatar") input[type="file"]');
    await avatarInput.setInputFiles(png);
    await expect(page.getByTestId("image-editor")).toBeVisible({ timeout: 10000 });

    const cropper = page.getByTestId("image-editor-cropper");
    const revBefore = await cropper.getAttribute("data-preview-rev");
    await expect(page.getByTestId("image-editor-undo")).toBeDisabled();

    await page.getByTestId("image-editor-filter-ember").click();
    await expect(page.getByTestId("image-editor-undo")).toBeEnabled({ timeout: 10000 });
    await expect
      .poll(async () => cropper.getAttribute("data-preview-rev"), { timeout: 10000 })
      .not.toBe(revBefore);

    const meanRedAfterFilter = await page.evaluate(() => {
      const img = document.querySelector(
        '[data-testid="image-editor-cropper"] img',
      ) as HTMLImageElement | null;
      if (!img?.complete || !img.naturalWidth) return null;
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let sum = 0;
      for (let i = 0; i < data.data.length; i += 4) sum += data.data[i];
      return sum / (data.data.length / 4);
    });
    expect(meanRedAfterFilter).not.toBeNull();

    await page.getByTestId("image-editor-undo").click();
    await expect(page.getByTestId("image-editor-undo")).toBeDisabled();

    await page.getByTestId("image-editor-filter-ember").click();
    await page.screenshot({ path: `${artifactsDir}/avatar-editor-ember-1280.png`, fullPage: false });

    const srcBefore =
      (await page.getByTestId("settings-avatar-preview").count()) > 0
        ? await page.getByTestId("settings-avatar-preview").getAttribute("src")
        : null;

    await page.getByTestId("image-editor-save").click();
    await page.waitForResponse((r) => r.url().includes("/api/me/avatar") && r.status() === 200, {
      timeout: 30000,
    });

    await expect(page.getByText(/profile photo updated/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("image-editor")).toBeHidden();
    await expect(page.getByTestId("settings-avatar-preview")).toBeVisible({ timeout: 10000 });

    await expect
      .poll(async () => page.getByTestId("settings-avatar-preview").getAttribute("src"), {
        timeout: 10000,
      })
      .not.toBe(srcBefore);

    await page.screenshot({ path: `${artifactsDir}/avatar-editor-saved-1280.png`, fullPage: false });
  });
});
