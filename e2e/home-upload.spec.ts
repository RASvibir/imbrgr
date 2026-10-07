import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");
const artifactsDir = "/opt/cursor/artifacts/screenshots";

async function dropFileOnHero(page: import("@playwright/test").Page, file: { name: string; mime: string; buffer: Buffer }) {
  const importDone = page.waitForResponse(
    (r) => r.url().includes("/api/studio/import") && r.status() === 200,
    { timeout: 20000 },
  );
  await page.getByTestId("home-studio-prompt").evaluate(
    (el, { name, mime, buf }) => {
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array(buf)], name, { type: mime }));
      for (const type of ["dragenter", "dragover", "drop"] as const) {
        el.dispatchEvent(new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt }));
      }
    },
    { name: file.name, mime: file.mime, buf: [...file.buffer] },
  );
  await importDone;
}

test.describe("home hero upload", () => {
  test("desktop: upload via button lands in refine with image", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByTestId("home-upload-input").setInputFiles(png);
    await expect(page).toHaveURL(/\/studio\?tab=refine&media=/, { timeout: 20000 });
    await expect(page.getByRole("navigation", { name: "Studio steps" }).getByRole("button", { name: "Refine" })).toHaveAttribute(
      "class",
      /accent-primary/,
    );
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible({ timeout: 15000 });
  });

  test("desktop: drag-drop upload", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const buffer = await fs.readFile(png);
    await dropFileOnHero(page, { name: "tiny.png", mime: "image/png", buffer });
    await expect(page).toHaveURL(/tab=refine&media=/, { timeout: 20000 });
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible({ timeout: 15000 });
  });

  test("desktop: typed text carries to Assist without auto-apply", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByTestId("home-prompt-input").fill("warmer sunset tones");
    await page.getByTestId("home-upload-input").setInputFiles(png);
    await expect(page).toHaveURL(/tab=refine&media=.*prompt=/, { timeout: 20000 });
    await expect(page.getByTestId("studio-assist-prompt")).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId("studio-assist-prompt")).toHaveValue("warmer sunset tones");
    await expect(page.getByRole("checkbox", { name: /Assist/i })).toBeChecked();
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible();
  });

  test("desktop: rejects non-image file", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.getByTestId("home-upload-input").setInputFiles({
      name: "notes.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("not an image"),
    });
    await expect(page.getByTestId("home-upload-error")).toBeVisible();
    await expect(page).toHaveURL("/");
  });

  test("mobile 390: upload via button", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByTestId("home-upload-input").setInputFiles(png);
    await expect(page).toHaveURL(/tab=refine&media=/, { timeout: 20000 });
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible({ timeout: 15000 });
  });

  test("capture hero screenshots", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.screenshot({ path: `${artifactsDir}/home-hero-390.png`, fullPage: false });
    await page.getByTestId("home-studio-prompt").dispatchEvent("dragenter");
    await page.getByTestId("home-studio-prompt").dispatchEvent("dragover");
    await page.screenshot({ path: `${artifactsDir}/home-hero-drop-390.png`, fullPage: false });
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    await page.screenshot({ path: `${artifactsDir}/home-hero-1280.png`, fullPage: false });
  });
});
