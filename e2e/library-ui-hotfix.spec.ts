import { test, expect } from "@playwright/test";

const artifactsDir = "/opt/cursor/artifacts/screenshots";

test.describe("library UI hotfix", () => {
  test("desktop 1280: no internal labels; folder add control visible", async ({ page }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width: 1280, height: 800 });

    const title = `lib-ui-hotfix ${Date.now()}`;
    await page.goto("/studio");
    await page.getByPlaceholder(/Describe the image/i).fill(title);
    await page.getByRole("button", { name: /Cook up image/i }).click();
    await expect(page).toHaveURL(/media=/, { timeout: 30000 });

    await page.goto("/library");
    await expect(page.getByTestId("my-images-panel")).toBeVisible();

    await expect(page.getByText("__studio_auto__")).toHaveCount(0);
    await expect(page.getByTestId("library-auto-saved-chip").first()).toBeVisible();

    const addBtn = page.getByTestId("library-new-folder-add");
    await expect(addBtn).toBeVisible();
    const box = await addBtn.boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(40);
    expect(box!.x + box!.width).toBeLessThanOrEqual(1280);

    await page.screenshot({ path: `${artifactsDir}/library-desktop-folder-add-1280.png`, fullPage: false });
  });
});

test.describe("post page mobile actions", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("owner menu has aria-label and does not cover Favorite", async ({ page }) => {
    const title = `mobile-post-actions ${Date.now()}`;
    await page.goto("/");
    const gen = await page.request.post("/api/ai/generate", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ prompt: title, visibility: "PUBLIC" }),
    });
    expect(gen.ok()).toBeTruthy();
    const genData = await gen.json();
    const mediaMeta = await page.request.get(`/api/media/${genData.mediaShortId}`);
    const share = await mediaMeta.json();
    const postShortId = share.share?.pageUrl?.match(/\/p\/([^/?#]+)/)?.[1];
    expect(postShortId).toBeTruthy();

    await page.goto(`/p/${postShortId}`);
    await expect(page.getByTestId("post-owner-menu")).toBeVisible({ timeout: 10000 });
    const ownerSummary = page.locator('[data-testid="post-owner-menu"] summary');
    await expect(ownerSummary).toHaveAttribute("aria-label", "Your post options");
    await expect(page.getByRole("button", { name: "Favorite" })).toBeVisible();

    const fav = page.getByRole("button", { name: "Favorite" });
    const owner = ownerSummary;
    const favBox = await fav.boundingBox();
    const ownerBox = await owner.boundingBox();
    expect(favBox).toBeTruthy();
    expect(ownerBox).toBeTruthy();
    const overlap =
      ownerBox!.x < favBox!.x + favBox!.width &&
      ownerBox!.x + ownerBox!.width > favBox!.x &&
      ownerBox!.y < favBox!.y + favBox!.height &&
      ownerBox!.y + ownerBox!.height > favBox!.y;
    expect(overlap).toBe(false);

    await page.screenshot({ path: `${artifactsDir}/post-mobile-actions-390.png`, fullPage: false });
  });
});
