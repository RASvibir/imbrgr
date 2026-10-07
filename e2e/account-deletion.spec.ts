import { test, expect } from "@playwright/test";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");

test.describe("account deletion", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("keeps public posts, removes private, profile 404", async ({ page }) => {
    const username = `acctdel${Date.now()}`.slice(0, 20);
    const email = `${username}@imbrgr.test`;
    const password = "password12345";
    const publicTitle = `public after delete ${Date.now()}`;
    const privateTitle = `private gone ${Date.now()}`;

    const signup = await page.request.post("/api/auth/signup", {
      data: { email, username, password },
    });
    expect(signup.ok()).toBeTruthy();

    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(png);
    await page.getByLabel("Title").fill(publicTitle);
    await page.getByRole("button", { name: /Serve it hot/i }).click();
    await page.waitForURL(/\/p\//, { timeout: 30000 });
    const publicUrl = page.url();
    const publicShortId = publicUrl.match(/\/p\/([^/?#]+)/)?.[1];
    expect(publicShortId).toBeTruthy();

    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(png);
    await page.getByLabel("Title").fill(privateTitle);
    await page.getByRole("radio", { name: /Private/i }).check();
    await page.getByRole("button", { name: /Serve it hot/i }).click();
    await page.waitForURL(/\/p\//, { timeout: 30000 });
    const privateShortId = page.url().match(/\/p\/([^/?#]+)/)?.[1];
    expect(privateShortId).toBeTruthy();

    await page.goto("/settings");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Delete my account/i }).click();
    await expect(page.getByRole("link", { name: /Sign in/i })).toBeVisible({ timeout: 15000 });

    const feed = await page.request.get("/api/posts?sort=newest");
    const feedJson = await feed.json();
    const feedIds = (feedJson.items ?? []).map((p: { shortId: string }) => p.shortId);
    expect(feedIds).toContain(publicShortId);

    const privateRes = await page.request.get(`/api/posts/${privateShortId}`);
    expect(privateRes.status()).toBe(404);

    await page.goto(publicUrl);
    await expect(page.getByTestId("post-author-deleted")).toHaveText("Deleted user");
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible();

    const profile = await page.goto(`/u/${username}`);
    expect(profile?.status()).toBe(404);
  });

  test("delete all posts option archives and removes public from site", async ({ page }) => {
    const username = `delall${Date.now()}`.slice(0, 18);
    const email = `${username}@imbrgr.test`;
    const password = "password12345";
    const publicTitle = `archive me ${Date.now()}`;

    await page.request.post("/api/auth/signup", {
      data: { email, username, password },
    });

    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/password/i).fill(password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(png);
    await page.getByLabel("Title").fill(publicTitle);
    await page.getByRole("button", { name: /Serve it hot/i }).click();
    await page.waitForURL(/\/p\//, { timeout: 30000 });
    const publicShortId = page.url().match(/\/p\/([^/?#]+)/)?.[1];
    expect(publicShortId).toBeTruthy();

    await page.goto("/settings");
    await page.getByTestId("delete-account-also-posts").check();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: /Delete my account/i }).click();
    await expect(page.getByRole("link", { name: /Sign in/i })).toBeVisible({ timeout: 15000 });

    expect((await page.request.get(`/api/posts/${publicShortId}`)).status()).toBe(404);
    const feed = await page.request.get("/api/posts?sort=newest");
    const feedIds = ((await feed.json()).items ?? []).map((p: { shortId: string }) => p.shortId);
    expect(feedIds).not.toContain(publicShortId);

    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2eadmin@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    const archiveRes = await page.request.get(`/api/admin/archive?q=${publicShortId}`);
    expect(archiveRes.ok()).toBeTruthy();
    const archive = await archiveRes.json();
    expect(
      (archive.posts as { originalShortId: string }[]).some((p) => p.originalShortId === publicShortId),
    ).toBe(true);
  });
});
