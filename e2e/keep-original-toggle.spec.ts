import { test, expect } from "@playwright/test";

const artifactsDir = "/opt/cursor/artifacts/screenshots";
const DESKTOP = { width: 1280, height: 800 };

async function autoLibraryMediaShortIds(request: import("@playwright/test").APIRequestContext) {
  const lib = await request.get("/api/library");
  const data = await lib.json();
  const saves = (data.saves ?? []) as { autoSaved?: boolean; media: { shortId: string } }[];
  return saves.filter((s) => s.autoSaved).map((s) => s.media.shortId);
}

test.describe("studio Keep original toggle", () => {
  test.use({ viewport: DESKTOP });

  test("unchecked: auto library keeps only latest; manual save works on original", async ({ page }) => {
    const prompt = `keep-off e2e ${Date.now()}`;

    await page.goto("/studio");
    await page.evaluate(() => localStorage.setItem("imbrgr_studio_keep_original", "0"));
    await page.getByTestId("studio-keep-original-checkbox").uncheck();

    await page.getByPlaceholder(/Describe the image/i).fill(prompt);
    await page.getByRole("button", { name: /Cook up image/i }).click();
    await expect(page).toHaveURL(/media=/, { timeout: 30000 });

    const mediaMatch = page.url().match(/media=([^&]+)/);
    const originalShortId = mediaMatch![1];

    let autoIds = await autoLibraryMediaShortIds(page.request);
    expect(autoIds).toContain(originalShortId);

    await page.getByRole("checkbox", { name: /Assist/i }).check();
    await page.getByTestId("studio-assist-prompt").fill("add fairies");
    await page.getByRole("button", { name: /Apply change/i }).click();
    await expect(page.getByTestId("ai-edit-preview")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /Keep/i }).click();
    await expect(page.getByTestId("studio-version-strip")).toBeVisible({ timeout: 10000 });

    const versionsRes = await page.request.get(`/api/media/${originalShortId}/versions`);
    const versionsBody = await versionsRes.json();
    const versions = versionsBody.versions as { shortId: string; locked: boolean }[];
    expect(versions.length).toBeGreaterThan(1);
    const editedShortId = versions.find((v) => !v.locked)?.shortId;
    expect(editedShortId).toBeTruthy();
    expect(editedShortId).not.toBe(originalShortId);

    autoIds = await autoLibraryMediaShortIds(page.request);
    expect(autoIds).toHaveLength(1);
    expect(autoIds[0]).toBe(editedShortId);
    expect(autoIds).not.toContain(originalShortId);

    await page.getByTestId("studio-version-original").click();
    await page.getByTestId("studio-image-hit-target").click();
    await page.getByTestId("studio-menu-save").click();
    await expect(page.getByText(/Saved to your images/i)).toBeVisible();

    const lib = await page.request.get("/api/library");
    const saves = (await lib.json()).saves as { media: { shortId: string } }[];
    expect(saves.some((s) => s.media.shortId === originalShortId)).toBe(true);

    await page.getByTestId("studio-image-hit-target").click();
    await expect(page.getByTestId("studio-menu-save")).toBeVisible();
    await expect(page.getByTestId("studio-menu-save-folder")).toBeVisible();
    await page.screenshot({ path: `${artifactsDir}/keep-original-off-manual-save-1280.png`, fullPage: false });
  });

  test("checked: auto library keeps original and edit; revert still works", async ({ page }) => {
    const prompt = `keep-on e2e ${Date.now()}`;

    await page.goto("/studio");
    await page.evaluate(() => localStorage.setItem("imbrgr_studio_keep_original", "1"));
    await expect(page.getByTestId("studio-keep-original-checkbox")).toBeChecked();

    await page.getByPlaceholder(/Describe the image/i).fill(prompt);
    await page.getByRole("button", { name: /Cook up image/i }).click();
    await expect(page).toHaveURL(/media=/, { timeout: 30000 });

    const originalShortId = page.url().match(/media=([^&]+)/)?.[1];
    const previewImg = page.locator('[data-testid="studio-image-hit-target"] img');
    const originalSrc = await previewImg.getAttribute("src");

    await page.getByRole("checkbox", { name: /Assist/i }).check();
    await page.getByTestId("studio-assist-prompt").fill("add fairies");
    await page.getByRole("button", { name: /Apply change/i }).click();
    await expect(page.getByTestId("ai-edit-preview")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /Keep/i }).click();

    const versionsRes = await page.request.get(`/api/media/${originalShortId}/versions`);
    const versionsBody = await versionsRes.json();
    const editedShortId = (versionsBody.versions as { shortId: string; locked: boolean }[]).find(
      (v) => !v.locked,
    )?.shortId;
    expect(editedShortId).toBeTruthy();
    const autoIds = await autoLibraryMediaShortIds(page.request);
    expect(autoIds).toContain(originalShortId);
    expect(autoIds).toContain(editedShortId);

    await page.getByTestId("studio-image-hit-target").click();
    await page.getByTestId("studio-menu-revert").click();
    await expect(previewImg).toHaveAttribute("src", originalSrc!, { timeout: 10000 });
    await page.screenshot({ path: `${artifactsDir}/keep-original-on-revert-1280.png`, fullPage: false });
  });
});
