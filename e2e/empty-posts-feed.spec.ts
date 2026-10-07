import { test, expect } from "@playwright/test";

const DESKTOP = { width: 1280, height: 800 };

test.describe("empty posts and empty states (desktop)", () => {
  test.use({ viewport: DESKTOP });

  test("deleting last image removes post from public feed", async ({ request }) => {
    const title = `empty-post-feed ${Date.now()}`;
    const gen = await request.post("/api/ai/generate", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ prompt: title, variations: 1, visibility: "PUBLIC" }),
    });
    expect(gen.ok()).toBeTruthy();
    const genBody = await gen.json();
    const mediaShortId = genBody.mediaShortId as string;
    const deleteToken = genBody.deleteToken as string | undefined;

    const feedBefore = await request.get("/api/posts?sort=newest");
    const before = await feedBefore.json();
    expect((before.items ?? []).some((p: { title: string }) => p.title === title)).toBe(true);

    const del = await request.delete(`/api/media/${mediaShortId}`, {
      data: deleteToken ? { deleteToken } : {},
    });
    expect(del.ok()).toBeTruthy();

    const feedAfter = await request.get("/api/posts?sort=newest");
    const after = await feedAfter.json();
    expect((after.items ?? []).some((p: { title: string }) => p.title === title)).toBe(false);
  });

  test("guest can delete own post with delete token", async ({ request }) => {
    const title = `guest-delete-post ${Date.now()}`;
    const gen = await request.post("/api/ai/generate", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ prompt: title, visibility: "PUBLIC" }),
    });
    expect(gen.ok()).toBeTruthy();
    const genData = await gen.json();
    const mediaShortId = genData.mediaShortId as string;
    const token = genData.deleteToken as string;
    expect(token).toBeTruthy();

    const mediaMeta = await request.get(`/api/media/${mediaShortId}`);
    expect(mediaMeta.ok()).toBeTruthy();
    const share = await mediaMeta.json();
    const postShortId = share.share?.pageUrl?.match(/\/p\/([^/?#]+)/)?.[1];
    expect(postShortId).toBeTruthy();

    const delPost = await request.delete(`/api/posts/${postShortId}`, {
      data: { deleteToken: token },
    });
    expect(delPost.ok()).toBeTruthy();

    const getPost = await request.get(`/api/posts/${postShortId}`);
    expect(getPost.status()).toBe(404);
  });

  test("search shows burger empty state when no results", async ({ page }) => {
    const q = `no-results-${Date.now()}`;
    await page.goto(`/search?q=${encodeURIComponent(q)}`);
    await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId("ember-hero-mark")).toBeVisible();
    await expect(page.getByText(/No matches on the menu/i)).toBeVisible();
  });

  test("profile collections tab shows empty state", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });
    await page.goto("/u/e2euser");
    await page.getByRole("button", { name: "collections" }).click();
    await expect(page.getByTestId("empty-state")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/No collections yet/i)).toBeVisible();
  });
});
