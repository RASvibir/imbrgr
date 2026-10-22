import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");

async function createPost(page: Page, title: string, mature: boolean): Promise<string> {
  const res = await page.request.post("/api/posts", {
    multipart: {
      title,
      mature: mature ? "true" : "false",
      files: { name: "tiny.png", mimeType: "image/png", buffer: fs.readFileSync(png) },
    },
  });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { shortId: string }).shortId;
}

type PostJson = { visibility: string; media: { shortId: string; mature: boolean }[] };

async function getPost(page: Page, shortId: string): Promise<PostJson> {
  const res = await page.request.get(`/api/posts/${shortId}`);
  expect(res.status()).toBe(200);
  return (await res.json()) as PostJson;
}

test.describe("mature content visibility", () => {
  test("a mature upload is never created as PUBLIC", async ({ page }) => {
    await page.goto("/");
    const matureId = await createPost(page, "e2e mature upload", true);
    const controlId = await createPost(page, "e2e normal upload", false);

    const mature = await getPost(page, matureId);
    expect(mature.media[0]?.mature).toBe(true);
    expect(mature.visibility).toBe("UNLISTED");

    const control = await getPost(page, controlId);
    expect(control.visibility).toBe("PUBLIC");

    const feed = await page.request.get("/api/posts?sort=newest");
    const ids = ((await feed.json()).items ?? []).map((p: { shortId: string }) => p.shortId);
    expect(ids).toContain(controlId);
    expect(ids).not.toContain(matureId);
  });

  test("an edited version of a mature image stays mature", async ({ page }) => {
    await page.goto("/");
    const postId = await createPost(page, "e2e mature edit", true);
    const parent = (await getPost(page, postId)).media[0]!;
    expect(parent.mature).toBe(true);

    const enhance = await page.request.post("/api/studio/auto-enhance", {
      data: { mediaShortId: parent.shortId },
    });
    expect(enhance.status()).toBe(200);
    const child = (await enhance.json()) as { shortId: string };

    const childRes = await page.request.get(`/api/media/${child.shortId}`);
    expect(childRes.status()).toBe(200);
    expect(((await childRes.json()) as { mature: boolean }).mature).toBe(true);
  });
});
