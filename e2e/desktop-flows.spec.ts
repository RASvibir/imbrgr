import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");
const artifactsDir = "/opt/cursor/artifacts/screenshots";
const DESKTOP = { width: 1280, height: 800 };

async function clickCookUp(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: /Cook up image/i }).click();
}

test.describe("desktop 1280×800 flows", () => {
  test.use({ viewport: DESKTOP });

  test("home hero: logo, prompt, and primary actions", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("home-hero")).toBeVisible();
    await expect(page.getByTestId("ember-hero-mark")).toBeVisible();
    await expect(page.getByTestId("home-studio-prompt")).toBeVisible();
    await expect(page.getByTestId("home-upload-button")).toBeVisible();
    await expect(page.getByRole("button", { name: /Cook up image/i })).toBeVisible();
    await page.screenshot({ path: `${artifactsDir}/desktop-home-hero-1280.png`, fullPage: false });
  });

  test("home upload lands in refine with assist prompt carryover", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("home-prompt-input").fill("warmer sunset tones");
    const importDone = page.waitForResponse(
      (r) => r.url().includes("/api/studio/import") && r.status() === 200,
      { timeout: 20000 },
    );
    await page.getByTestId("home-upload-input").setInputFiles(png);
    await importDone;
    await expect(page).toHaveURL(/tab=refine&media=.*prompt=/, { timeout: 20000 });
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible({ timeout: 15000 });
    const assist = page.getByTestId("studio-assist-prompt");
    if (!(await assist.isVisible())) {
      await page.getByRole("checkbox", { name: /Assist/i }).check();
    }
    await expect(assist).toHaveValue("warmer sunset tones");
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${artifactsDir}/desktop-refine-after-upload-1280.png`, fullPage: false });
  });

  test("studio generate, gallery feed, and assist content edit", async ({ page, request }) => {
    const title = `desktop e2e ${Date.now()}`;
    await page.goto("/studio");
    await expect(page.getByRole("button", { name: /Cook up image/i })).toBeVisible();
    await page.getByPlaceholder(/Describe the image/i).fill(title);
    await clickCookUp(page);
    await expect(page.getByText(/on the gallery/i)).toBeVisible({ timeout: 30000 });
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible();

    const feed = await request.get("/api/posts?sort=newest");
    const data = await feed.json();
    expect((data.items ?? []).some((p: { title: string }) => p.title === title)).toBe(true);

    await page.getByRole("checkbox", { name: /Assist/i }).check();
    await page.getByTestId("studio-assist-prompt").fill("add fairies");
    await page.getByRole("button", { name: /Apply change/i }).click();
    await expect(page.getByTestId("ai-edit-preview")).toBeVisible({ timeout: 30000 });
    await page.screenshot({ path: `${artifactsDir}/desktop-studio-assist-1280.png`, fullPage: false });
  });

  test("studio visibility: private keeps post off public feed", async ({ page, request }) => {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    const title = `desktop private ${Date.now()}`;
    await page.goto("/studio");
    await page.getByText("More options").click();
    await page.getByTestId("studio-visibility-private").check();
    await page.getByPlaceholder(/Describe the image/i).fill(title);
    await clickCookUp(page);
    await expect(page.getByText(/won't show on the public gallery/i)).toBeVisible({ timeout: 30000 });

    const feed = await request.get("/api/posts?sort=newest");
    const data = await feed.json();
    expect((data.items ?? []).some((p: { title: string }) => p.title === title)).toBe(false);
  });
});
