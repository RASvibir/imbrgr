import { test, expect } from "@playwright/test";

const artifactsDir = "/opt/cursor/artifacts/screenshots";
const DESKTOP = { width: 1280, height: 800 };

test.describe("studio Keep original toggle", () => {
  test.use({ viewport: DESKTOP });

  test("unchecked: in-place AI edit, no version strip or revert", async ({ page }) => {
    const prompt = `keep-off e2e ${Date.now()}`;

    await page.goto("/studio");
    await page.evaluate(() => localStorage.removeItem("imbrgr_studio_keep_original"));
    await page.getByTestId("studio-keep-original-checkbox").uncheck();
    await expect(page.getByTestId("studio-keep-original-checkbox")).not.toBeChecked();

    await page.getByPlaceholder(/Describe the image/i).fill(prompt);
    await page.getByRole("button", { name: /Cook up image/i }).click();
    await expect(page).toHaveURL(/media=/, { timeout: 30000 });

    const mediaMatch = page.url().match(/media=([^&]+)/);
    expect(mediaMatch?.[1]).toBeTruthy();
    const mediaShortId = mediaMatch![1];

    const previewImg = page.locator('[data-testid="studio-image-hit-target"] img');
    const beforeSrc = await previewImg.getAttribute("src");

    await page.getByRole("checkbox", { name: /Assist/i }).check();
    await page.getByTestId("studio-assist-prompt").fill("add fairies");
    await page.getByRole("button", { name: /Apply change/i }).click();
    await expect(page.getByTestId("ai-edit-preview")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /Keep/i }).click();

    await expect(page).toHaveURL(new RegExp(`media=${mediaShortId}`));
    await expect(page.getByTestId("studio-version-strip")).toHaveCount(0);
    const afterSrc = await previewImg.getAttribute("src");
    expect(afterSrc).not.toBe(beforeSrc);

    await page.getByTestId("studio-image-hit-target").click();
    await expect(page.getByTestId("studio-image-menu")).toBeVisible();
    await expect(page.getByTestId("studio-menu-revert")).toHaveCount(0);
    await page.screenshot({ path: `${artifactsDir}/keep-original-off-inplace-1280.png`, fullPage: false });
  });

  test("checked: version strip and revert after assist edit", async ({ page }) => {
    const prompt = `keep-on e2e ${Date.now()}`;

    await page.goto("/studio");
    await page.evaluate(() => localStorage.setItem("imbrgr_studio_keep_original", "1"));
    await expect(page.getByTestId("studio-keep-original-checkbox")).toBeChecked();

    await page.getByPlaceholder(/Describe the image/i).fill(prompt);
    await page.getByRole("button", { name: /Cook up image/i }).click();
    await expect(page).toHaveURL(/media=/, { timeout: 30000 });

    const previewImg = page.locator('[data-testid="studio-image-hit-target"] img');
    const originalSrc = await previewImg.getAttribute("src");

    await page.getByRole("checkbox", { name: /Assist/i }).check();
    await page.getByTestId("studio-assist-prompt").fill("add fairies");
    await page.getByRole("button", { name: /Apply change/i }).click();
    await expect(page.getByTestId("ai-edit-preview")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /Keep/i }).click();

    await expect(page.getByTestId("studio-version-strip")).toBeVisible({ timeout: 10000 });
    await page.getByTestId("studio-image-hit-target").click();
    await expect(page.getByTestId("studio-menu-revert")).toBeVisible();
    await page.getByTestId("studio-menu-revert").click();
    await expect(previewImg).toHaveAttribute("src", originalSrc!, { timeout: 10000 });
    await page.screenshot({ path: `${artifactsDir}/keep-original-on-revert-1280.png`, fullPage: false });
  });
});
