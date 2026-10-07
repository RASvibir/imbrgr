import { test, expect } from "@playwright/test";
import { execSync } from "node:child_process";
import path from "node:path";

const DESKTOP = { width: 1280, height: 800 };
const root = path.join(__dirname, "..");

function createImagelessPost(): string {
  return execSync("npx tsx scripts/e2e-imageless-post.ts", {
    cwd: root,
    encoding: "utf8",
    env: process.env as NodeJS.ProcessEnv,
  }).trim();
}

test.describe("post owner menu and imageless posts", () => {
  test.use({ viewport: DESKTOP });

  test("guest deletes own post from owner menu with confirm", async ({ page }) => {
    const title = `guest-ui-delete ${Date.now()}`;
    const gen = await page.request.post("/api/ai/generate", {
      headers: { "Content-Type": "application/json" },
      data: JSON.stringify({ prompt: title, visibility: "PUBLIC" }),
    });
    expect(gen.ok()).toBeTruthy();
    const genData = await gen.json();
    const mediaShortId = genData.mediaShortId as string;

    const mediaMeta = await page.request.get(`/api/media/${mediaShortId}`);
    expect(mediaMeta.ok()).toBeTruthy();
    const share = await mediaMeta.json();
    const postShortId = share.share?.pageUrl?.match(/\/p\/([^/?#]+)/)?.[1];
    expect(postShortId).toBeTruthy();

    page.once("dialog", (dialog) => {
      expect(dialog.type()).toBe("confirm");
      void dialog.accept();
    });

    await page.goto(`/p/${postShortId}`);
    await expect(page.getByTestId("post-owner-menu")).toBeVisible();
    await page.getByTestId("post-owner-menu").locator("summary").click();
    await page.getByTestId("post-owner-delete").click();
    await expect(page).toHaveURL("/", { timeout: 15000 });

    const gone = await page.request.get(`/api/posts/${postShortId}`);
    expect(gone.status()).toBe(404);
  });

  test("direct visit to imageless post returns not found", async ({ page, request }) => {
    const shortId = createImagelessPost();
    const api = await request.get(`/api/posts/${shortId}`);
    expect(api.status()).toBe(404);

    const res = await page.goto(`/p/${shortId}`);
    expect(res?.status()).toBe(404);
    await expect(page.getByText(/wandered off the menu/i)).toBeVisible();
  });
});
