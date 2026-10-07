import { test, expect } from "@playwright/test";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");

function postShortIdFromUrl(url: string): string | null {
  const m = url.match(/\/p\/([^/?#]+)/);
  return m?.[1] ?? null;
}

test.describe("gallery default public", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("guest home upload appears on newest feed", async ({ page }) => {
    await page.goto("/");
    const importRes = page.waitForResponse(
      (r) => r.url().includes("/api/studio/import") && r.status() === 200,
      { timeout: 20000 },
    );
    await page.getByTestId("home-upload-input").setInputFiles(png);
    const res = await importRes;
    const body = (await res.json()) as { postShortId?: string };
    expect(body.postShortId).toBeTruthy();

    const feed = await page.request.get("/api/posts?sort=newest");
    const data = await feed.json();
    const ids = (data.items ?? []).map((p: { shortId: string }) => p.shortId);
    expect(ids).toContain(body.postShortId);
  });

  test("guest cannot choose private visibility in studio", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.getByTestId("guest-gallery-visibility-note")).toBeVisible();
    await expect(page.getByTestId("studio-visibility-private")).toHaveCount(0);
  });

  test("guest media PATCH cannot make post private", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("home-upload-input").setInputFiles(png);
    await expect(page).toHaveURL(/tab=share&media=/, { timeout: 20000 });
    await expect(page.getByTestId("share-choice-card")).toBeVisible({ timeout: 15000 });
    const mediaMatch = page.url().match(/media=([^&]+)/);
    const mediaShortId = mediaMatch?.[1];
    expect(mediaShortId).toBeTruthy();

    const patch = await page.request.patch(`/api/media/${mediaShortId}`, {
      data: { visibility: "PRIVATE" },
    });
    expect(patch.ok()).toBeTruthy();

    const media = await page.request.get(`/api/media/${mediaShortId}`);
    const mediaJson = await media.json();
    expect(mediaJson.visibility).toBe("PUBLIC");
  });

  test("signed-in upload defaults public on feed", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    const title = `gallery public default ${Date.now()}`;
    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(png);
    await page.getByTestId("upload-submit").click();
    await expect(page.getByTestId("share-choice-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("share-choice-gallery-title").fill(title);
    await page.getByTestId("share-choice-post-gallery").click();

    const feed = await page.request.get("/api/posts?sort=newest");
    const data = await feed.json();
    const titles = (data.items ?? []).map((p: { title: string }) => p.title);
    expect(titles).toContain(title);
  });

  test("signed-in private choice stays off public feed", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    const title = `gallery unlisted opt ${Date.now()}`;
    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(png);
    await page.getByTestId("upload-submit").click();
    await expect(page.getByTestId("share-choice-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("share-choice-gallery-title").fill(title);
    await page.getByTestId("share-choice-copy-link").click();

    const feed = await page.request.get("/api/posts?sort=newest");
    const data = await feed.json();
    const titles = (data.items ?? []).map((p: { title: string }) => p.title);
    expect(titles).not.toContain(title);
  });
});
