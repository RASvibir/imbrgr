import { test, expect, type Page } from "@playwright/test";

async function createPost(page: Page): Promise<string> {
  const gen = await page.request.post("/api/ai/generate", {
    headers: { "Content-Type": "application/json" },
    data: JSON.stringify({ prompt: `comments-e2e ${Date.now()}`, visibility: "PUBLIC" }),
  });
  expect(gen.ok()).toBeTruthy();
  const { mediaShortId } = await gen.json();
  const meta = await page.request.get(`/api/media/${mediaShortId}`);
  expect(meta.ok()).toBeTruthy();
  const share = await meta.json();
  const postShortId = share.share?.pageUrl?.match(/\/p\/([^/?#]+)/)?.[1] as string | undefined;
  expect(postShortId).toBeTruthy();
  return postShortId!;
}

test.describe("post comments", () => {
  test("top-level comment and reply post and persist after reload", async ({ page }) => {
    const shortId = await createPost(page);
    const top = `top-level ${Date.now()}`;
    const reply = `reply ${Date.now()}`;

    await page.goto(`/p/${shortId}`);

    const topPost = page.waitForResponse(
      (r) => r.url().includes(`/api/posts/${shortId}/comments`) && r.request().method() === "POST",
    );
    await page.getByPlaceholder("Add a comment").fill(top);
    await page.getByRole("button", { name: "Post comment" }).click();
    expect((await topPost).status()).toBe(200);
    await expect(page.getByText(top)).toBeVisible();

    const replyPost = page.waitForResponse(
      (r) => r.url().includes(`/api/posts/${shortId}/comments`) && r.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Reply", exact: true }).first().click();
    await page.getByPlaceholder("Reply…").fill(reply);
    await page.getByRole("button", { name: "Post comment" }).click();
    expect((await replyPost).status()).toBe(200);
    await expect(page.getByText(reply)).toBeVisible();

    await page.reload();
    await expect(page.getByText(top)).toBeVisible();
    await expect(page.getByText(reply)).toBeVisible();
  });

  test("API accepts parentId null and rejects a parent from another post", async ({ page }) => {
    const shortId = await createPost(page);
    const otherShortId = await createPost(page);

    const topLevel = await page.request.post(`/api/posts/${shortId}/comments`, {
      data: { body: "null parent regression", parentId: null },
    });
    expect(topLevel.status()).toBe(200);
    const created = await topLevel.json();

    const crossPost = await page.request.post(`/api/posts/${otherShortId}/comments`, {
      data: { body: "wrong post parent", parentId: created.id },
    });
    expect(crossPost.status()).toBe(400);
    expect((await crossPost.json()).error).toMatch(/parent/i);
  });

  test("a blocked comment is rejected and not shown", async ({ page }) => {
    const shortId = await createPost(page);
    const res = await page.request.post(`/api/posts/${shortId}/comments`, {
      data: { body: "this is nsfw content" },
    });
    expect(res.status()).toBe(400);
    const list = await (await page.request.get(`/api/posts/${shortId}/comments`)).json();
    expect(list).toHaveLength(0);
  });
});
