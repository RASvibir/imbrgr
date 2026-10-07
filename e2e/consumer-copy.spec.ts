import { test, expect } from "@playwright/test";
import { findInternalConsumerCopy } from "../src/lib/consumer-copy-denylist";

test.describe("consumer-facing copy", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  async function expectCleanPage(page: import("@playwright/test").Page, path: string) {
    const res = await page.goto(path);
    expect(res?.status()).toBeLessThan(500);
    const text = await page.locator("body").innerText();
    const hit = findInternalConsumerCopy(text);
    expect(hit, `internal term "${hit}" on ${path}`).toBeNull();
  }

  test("public routes stay free of internal wording", async ({ page, request }) => {
    const routes = ["/", "/hot", "/studio", "/upload", "/library", "/tags", "/search"];
    for (const path of routes) {
      await expectCleanPage(page, path);
    }

    const feed = await request.get("/api/posts?sort=newest");
    const data = await feed.json();
    const shortId = data.items?.[0]?.shortId as string | undefined;
    if (shortId) {
      await expectCleanPage(page, `/p/${shortId}`);
    }

    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    await expectCleanPage(page, "/u/e2euser");
    await expectCleanPage(page, "/settings");

    const missing = await page.goto("/this-route-is-not-on-the-menu");
    expect(missing?.status()).toBe(404);
    const notFoundText = await page.locator("body").innerText();
    expect(findInternalConsumerCopy(notFoundText)).toBeNull();
  });
});
