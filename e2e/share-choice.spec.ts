import { test, expect } from "@playwright/test";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");

test.describe("share choice: link vs gallery", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  async function signIn(page: import("@playwright/test").Page) {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });
  }

  test("signed-in copy link keeps post off newest feed", async ({ page, context }) => {
    await signIn(page);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(png);
    const title = `share choice unlisted ${Date.now()}`;
    await page.getByTestId("upload-submit").click();
    await expect(page.getByTestId("share-choice-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("share-choice-gallery-title").fill(title);
    await page.getByTestId("share-choice-copy-link").click();
    await expect(page.getByTestId("share-choice-toast")).toContainText(/link copied/i);

    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/^https?:\/\//);

    const feed = await page.request.get("/api/posts?sort=newest");
    const data = await feed.json();
    const titles = (data.items ?? []).map((p: { title: string }) => p.title);
    expect(titles).not.toContain(title);
  });

  test("signed-in post to gallery appears on newest feed", async ({ page }) => {
    await signIn(page);
    const title = `share choice public ${Date.now()}`;
    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(png);
    await page.getByTestId("upload-submit").click();
    await expect(page.getByTestId("share-choice-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("share-choice-gallery-title").fill(title);
    await page.getByTestId("share-choice-post-gallery").click();
    await expect(page.getByTestId("share-choice-toast")).toContainText(/posted/i);

    const feed = await page.request.get("/api/posts?sort=newest");
    const data = await feed.json();
    const titles = (data.items ?? []).map((p: { title: string }) => p.title);
    expect(titles).toContain(title);
  });

  test("guest sees copy link only and stays on public feed", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const importRes = page.waitForResponse(
      (r) => r.url().includes("/api/studio/import") && r.status() === 200,
      { timeout: 20000 },
    );
    await page.getByTestId("home-upload-input").setInputFiles(png);
    const res = await importRes;
    const body = (await res.json()) as { postShortId?: string };
    expect(body.postShortId).toBeTruthy();

    await expect(page).toHaveURL(/tab=share&media=/, { timeout: 20000 });
    await expect(page.getByTestId("share-choice-guest-gallery-note")).toBeVisible();
    await expect(page.getByTestId("share-choice-post-gallery")).toHaveCount(0);

    await page.getByTestId("share-choice-copy-link").click();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/^https?:\/\//);

    const feed = await page.request.get("/api/posts?sort=newest");
    const data = await feed.json();
    const ids = (data.items ?? []).map((p: { shortId: string }) => p.shortId);
    expect(ids).toContain(body.postShortId);
  });
});
