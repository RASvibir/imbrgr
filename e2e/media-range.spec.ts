import { test, expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");

async function uploadAndGetFileUrl(page: Page): Promise<{ url: string; size: number }> {
  await page.goto("/");
  const created = await page.request.post("/api/posts", {
    multipart: {
      title: "e2e range",
      files: { name: "tiny.png", mimeType: "image/png", buffer: fs.readFileSync(png) },
    },
  });
  expect(created.status()).toBe(200);
  const postShortId = ((await created.json()) as { shortId: string }).shortId;

  const post = (await (await page.request.get(`/api/posts/${postShortId}`)).json()) as {
    media: { shortId: string }[];
  };
  const info = (await (await page.request.get(`/api/media/${post.media[0]!.shortId}`)).json()) as {
    storageKey: string;
    mimeType: string;
    byteSize: number;
  };
  const url = `/api/media/file/${info.storageKey}?mime=${encodeURIComponent(info.mimeType)}`;
  return { url, size: info.byteSize };
}

test.describe("media file byte-range support", () => {
  test("serves full files and correct partial content", async ({ page }) => {
    const { url, size } = await uploadAndGetFileUrl(page);
    expect(size).toBeGreaterThan(20);

    const full = await page.request.get(url);
    expect(full.status()).toBe(200);
    expect(full.headers()["accept-ranges"]).toBe("bytes");
    expect(full.headers()["content-length"]).toBe(String(size));
    const fullBody = await full.body();
    expect(fullBody.length).toBe(size);

    const cases: { header: string; start: number; end: number }[] = [
      { header: "bytes=0-9", start: 0, end: 9 },
      { header: "bytes=10-", start: 10, end: size - 1 },
      { header: "bytes=-5", start: size - 5, end: size - 1 },
      { header: `bytes=${size - 3}-${size + 500}`, start: size - 3, end: size - 1 },
    ];
    for (const c of cases) {
      const res = await page.request.get(url, { headers: { Range: c.header } });
      expect(res.status(), c.header).toBe(206);
      expect(res.headers()["content-range"], c.header).toBe(`bytes ${c.start}-${c.end}/${size}`);
      expect(res.headers()["content-length"], c.header).toBe(String(c.end - c.start + 1));
      expect(res.headers()["accept-ranges"], c.header).toBe("bytes");
      expect(Buffer.compare(await res.body(), fullBody.subarray(c.start, c.end + 1)), c.header).toBe(0);
    }
  });

  test("rejects unsatisfiable ranges and ignores malformed ones", async ({ page }) => {
    const { url, size } = await uploadAndGetFileUrl(page);

    const past = await page.request.get(url, { headers: { Range: `bytes=${size + 100}-` } });
    expect(past.status()).toBe(416);
    expect(past.headers()["content-range"]).toBe(`bytes */${size}`);

    const bad = await page.request.get(url, { headers: { Range: "bytes=abc" } });
    expect(bad.status()).toBe(200);
    expect((await bad.body()).length).toBe(size);
  });

  test("range requests respect the same access rules as full requests", async ({ page, browser }) => {
    const { url } = await uploadAndGetFileUrl(page);
    // A fresh anonymous context can view PUBLIC media, so a range request works for it too.
    const other = await browser.newContext();
    const res = await other.request.get(new URL(url, "http://127.0.0.1:3000").toString(), {
      headers: { Range: "bytes=0-3" },
    });
    expect(res.status()).toBe(206);
    await other.close();

    // A key that maps to no media row is a 404 even with a Range header.
    const missing = await page.request.get("/api/media/file/does-not-exist.png", { headers: { Range: "bytes=0-3" } });
    expect(missing.status()).toBe(404);
  });
});
