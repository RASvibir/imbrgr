import { test, expect, type Page } from "@playwright/test";
import { findInternalConsumerCopy } from "../src/lib/consumer-copy-denylist";

const PUBLIC_ROUTES = [
  "/",
  "/hot",
  "/studio",
  "/studio?tab=video",
  "/upload",
  "/library",
  "/tags",
  "/search",
  "/tools",
  "/tools/gif",
  "/tools/collage",
  "/tools/filters",
];

async function expectCleanPage(page: Page, path: string) {
  const res = await page.goto(path);
  expect(res?.status(), `status for ${path}`).toBeLessThan(500);
  const text = await page.locator("body").innerText();
  const hit = findInternalConsumerCopy(text);
  expect(hit, `internal term "${hit}" on ${path}`).toBeNull();
}

async function signInE2E(page: Page) {
  await page.goto("/auth/signin");
  await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
  await page.getByPlaceholder(/password/i).fill("password12345");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });
}

test.describe("consumer-facing copy", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  for (const route of PUBLIC_ROUTES) {
    test(`public route ${route} has no internal wording`, async ({ page }) => {
      await expectCleanPage(page, route);
    });
  }

  test("404 page has no internal wording", async ({ page }) => {
    const missing = await page.goto("/this-route-is-not-on-the-menu");
    expect(missing?.status()).toBe(404);
    const text = await page.locator("body").innerText();
    expect(findInternalConsumerCopy(text)).toBeNull();
  });

  test.describe("signed in", () => {
    test.beforeEach(async ({ page }) => {
      await signInE2E(page);
    });

    for (const route of ["/u/e2euser", "/settings"]) {
      test(`signed-in route ${route} has no internal wording`, async ({ page }) => {
        await expectCleanPage(page, route);
      });
    }
  });
});
