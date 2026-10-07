import { test, expect } from "@playwright/test";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");

test.describe("share burger tray", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("feed card opens tray and copies each format", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto("/");
    const card = page.locator("article.group").first();
    await expect(card).toBeVisible({ timeout: 15000 });
    await card.hover();
    const burger = card.getByTestId("share-burger-button");
    await expect(burger).toBeVisible();
    await burger.click();
    const tray = page.getByTestId("share-burger-tray");
    await expect(tray).toBeVisible();

    const rows = [
      { testId: "share-copy-page", expect: /\/p\// },
      { testId: "share-copy-direct", expect: /\/api\/media\/file\// },
      { testId: "share-copy-markdown", expect: /!\[/ },
      { testId: "share-copy-html", expect: /<img / },
      { testId: "share-copy-bbcode", expect: /\[img\]/ },
    ];

    for (const row of rows) {
      await tray.getByTestId(row.testId).click();
      await expect(tray.getByTestId(row.testId)).toContainText(/copied/i);
      const text = await page.evaluate(() => navigator.clipboard.readText());
      expect(text).toMatch(row.expect);
    }
  });

  test("post page opens tray per image", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    const feed = await page.request.get("/api/posts?sort=newest");
    const data = await feed.json();
    const shortId = data.items?.[0]?.shortId as string | undefined;
    test.skip(!shortId, "no posts in feed");

    await page.goto(`/p/${shortId}`);
    const mediaBlock = page.locator(".group.relative.overflow-hidden.rounded-xl").first();
    await mediaBlock.hover();
    await mediaBlock.getByTestId("share-burger-button").click();
    await expect(page.getByTestId("share-burger-tray")).toBeVisible();
    await page.getByTestId("share-copy-direct").click();
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/^https?:\/\//);
  });
});
