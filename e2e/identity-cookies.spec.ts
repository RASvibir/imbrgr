import { test, expect } from "@playwright/test";

/**
 * Regression: read-only GETs must never mint the guest identity cookie.
 *
 * On a first visit the home page fires many concurrent GETs (gallery thumbnails, usage, storage,
 * library). When each of them set its own `imbrgr_vid`, the last Set-Cookie won and could orphan
 * whatever the visitor had just created (the studio then showed its empty state).
 */
const READ_ONLY_ROUTES = [
  "/api/ai/usage",
  "/api/me/storage",
  "/api/library",
  "/api/media/does-not-exist",
  "/api/media/file/does-not-exist/none.png",
];

test.describe("guest identity cookie", () => {
  for (const route of READ_ONLY_ROUTES) {
    test(`GET ${route} does not set imbrgr_vid`, async ({ playwright, baseURL }) => {
      const ctx = await playwright.request.newContext({ baseURL });
      const res = await ctx.get(route);
      const setCookies = res.headersArray().filter((h) => h.name.toLowerCase() === "set-cookie");
      expect(setCookies.map((h) => h.value).join("\n")).not.toContain("imbrgr_vid");
      await ctx.dispose();
    });
  }
});
