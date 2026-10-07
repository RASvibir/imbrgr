import { test, expect } from "@playwright/test";
const artifactsDir = "/opt/cursor/artifacts/screenshots";
const DESKTOP = { width: 1280, height: 800 };

test.describe("studio library save and locked original", () => {
  test.use({ viewport: DESKTOP });

  test("generate → save to new folder → appears in library; edit → revert restores original", async ({
    page,
  }) => {
    const folderName = `e2e folder ${Date.now()}`;
    const prompt = `library e2e ${Date.now()}`;

    await page.goto("/studio");
    await page.getByPlaceholder(/Describe the image/i).fill(prompt);
    await page.getByRole("button", { name: /Cook up image/i }).click();
    await expect(page.getByText(/on the gallery|saved/i)).toBeVisible({ timeout: 30000 });
    await expect(page).toHaveURL(/media=/, { timeout: 15000 });
    const studioUrl = page.url();

    const previewImg = page.locator('[data-testid="studio-image-hit-target"] img');
    await expect(previewImg).toBeVisible();
    const originalSrc = await previewImg.getAttribute("src");
    expect(originalSrc).toBeTruthy();

    await page.getByTestId("studio-image-hit-target").click();
    await expect(page.getByTestId("studio-image-menu")).toBeVisible();
    await page.getByTestId("studio-menu-save-folder").click();
    await page.getByTestId("studio-save-folder-name").fill(folderName);
    await page.getByRole("button", { name: /Save here/i }).click();
    await expect(page.getByText(new RegExp(folderName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")))).toBeVisible({
      timeout: 10000,
    });

    await page.goto("/library");
    await expect(page.getByTestId("my-images-panel")).toBeVisible();
    await page.getByRole("button", { name: new RegExp(folderName) }).click();
    await expect(page.getByTestId("library-active-folder-title")).toHaveText(folderName);
    await expect(page.locator('[data-testid^="library-save-"]').first()).toBeVisible();
    await page.screenshot({ path: `${artifactsDir}/library-folder-save-1280.png`, fullPage: false });

    await page.goto(studioUrl);
    await expect(previewImg).toBeVisible({ timeout: 15000 });

    await page.getByRole("checkbox", { name: /Assist/i }).check();
    await page.getByTestId("studio-assist-prompt").fill("add fairies");
    await page.getByRole("button", { name: /Apply change/i }).click();
    await expect(page.getByTestId("ai-edit-preview")).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: /Keep/i }).click();
    await expect(page.getByTestId("studio-version-strip")).toBeVisible({ timeout: 10000 });

    const editedSrc = await previewImg.getAttribute("src");
    expect(editedSrc).not.toBe(originalSrc);

    await page.getByTestId("studio-image-hit-target").click();
    await page.getByTestId("studio-menu-revert").click();
    await expect(previewImg).toHaveAttribute("src", originalSrc!, { timeout: 10000 });
    await page.screenshot({ path: `${artifactsDir}/library-revert-original-1280.png`, fullPage: false });
  });
});
