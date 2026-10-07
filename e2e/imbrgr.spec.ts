import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");
const artifactsDir = "/opt/cursor/artifacts/screenshots";

async function clickCookUp(page: import("@playwright/test").Page) {
  const mobile = page.getByTestId("studio-mobile-generate");
  if (await mobile.isVisible()) {
    await mobile.click();
    return;
  }
  await page.getByRole("button", { name: /Cook up image/i }).click();
}

test.describe("imbrgr e2e", () => {
  test("studio page uses consumer-friendly copy", async ({ page }) => {
    await page.goto("/studio");
    const text = (await page.locator("main").innerText()).toLowerCase();
    expect(text).not.toMatch(
      /pollinations|gemini|ollama|groq|flux|daily ai|ai generations|generate with|enhance prompt|cached repeats|token|\/ 50 mb/,
    );
  });

  test("studio opens with prompt box on load", async ({ page }) => {
    await page.goto("/studio");
    await expect(page.getByPlaceholder(/Describe the image/i)).toBeVisible({ timeout: 5000 });
    const cookVisible =
      (await page.getByTestId("studio-mobile-generate").isVisible()) ||
      (await page.getByRole("button", { name: /Cook up image/i }).isVisible());
    expect(cookVisible).toBe(true);
    await page.screenshot({ path: `${artifactsDir}/studio-create-hero.png`, fullPage: true });
  });

  test("studio ?tab=generate legacy URL shows prompt", async ({ page }) => {
    await page.goto("/studio?tab=generate");
    await expect(page.getByPlaceholder(/Describe the image/i)).toBeVisible({ timeout: 5000 });
  });

  test("desktop header nav links share vertical alignment", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Main" });
    const linkNames = ["Gallery", "Hot", "Studio", "Tags", "Search", "Sign in"];
    const boxes = await Promise.all(
      linkNames.map((name) =>
        nav.getByRole("link", { name, exact: true }).boundingBox(),
      ),
    );
    const tops = boxes.map((b) => b?.y).filter((y): y is number => y != null);
    expect(tops.length).toBe(linkNames.length);
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  });

  test("anonymous browse home and studio", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Studio" }).first()).toBeVisible();
    await expect(page.getByPlaceholder(/Describe an image, or drop one in to edit/i).first()).toBeVisible();
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: /Image studio/i })).toBeVisible();
  });

  test("hot feed images stay visible after cached navigation from home", async ({ page }) => {
    await page.goto("/");
    await page.goto("/hot");
    const img = page.getByTestId("post-media-image").first();
    await expect(img).toBeVisible({ timeout: 15000 });
    await expect(img).toHaveCSS("opacity", "1", { timeout: 5000 });
  });

  test("anonymous studio import and share tab", async ({ page, request }) => {
    await page.goto("/studio");
    await page.locator("summary").filter({ hasText: "Bring your own image" }).click();
    await page.locator('input[type="file"]').setInputFiles(png);
    await expect(page.getByText(/Ready in the studio/i)).toBeVisible({ timeout: 15000 });
    const importRes = await request.post("/api/studio/import", {
      multipart: {
        file: {
          name: "tiny.png",
          mimeType: "image/png",
          buffer: await fs.readFile(png),
        },
      },
    });
    const imported = await importRes.json();
    expect(imported.storageKey).toBeTruthy();
    const fileRes = await request.get(
      `/api/media/file/${imported.storageKey}?mime=${encodeURIComponent("image/png")}`,
    );
    expect(fileRes.status()).toBe(200);
    expect(fileRes.headers()["content-type"]).toMatch(/image\//);
    const jsonRes = await request.get(`/api/media/${imported.shortId}`);
    expect(jsonRes.status()).toBe(200);
    expect(jsonRes.headers()["content-type"]).toMatch(/application\/json/);
    await page.getByRole("navigation", { name: "Studio steps" }).getByRole("button", { name: "Share" }).click();
    await expect(page.getByTestId("share-panel")).toBeVisible();
  });

  test("public image page exposes og:image for crawlers", async ({ page, request }) => {
    const importRes = await request.post("/api/studio/import", {
      multipart: {
        file: {
          name: "tiny.png",
          mimeType: "image/png",
          buffer: await fs.readFile(png),
        },
      },
    });
    const imported = await importRes.json();
    await page.goto(`/i/${imported.shortId}`);
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
    expect(ogImage).toMatch(/\/api\/og\/m\//);
    expect(ogImage).toContain(imported.shortId);
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute("content");
    expect(ogUrl).toMatch(/\/i\//);
    const ogRes = await request.get(`/api/og/m/${imported.shortId}`);
    expect(ogRes.status()).toBe(200);
    expect(ogRes.headers()["content-type"]).toMatch(/image\//);
  });

  test("anonymous AI generate mock", async ({ page }) => {
    await page.goto("/studio");
    await page.getByPlaceholder(/Describe the image/i).fill("ember burger test");
    await clickCookUp(page);
    await expect(page.getByText(/on the gallery/i)).toBeVisible({ timeout: 30000 });
    await expect(page.locator('img[src*="/api/media/file/"]')).toBeVisible();
    await page.screenshot({ path: `${artifactsDir}/studio-after-generate.png`, fullPage: true });
  });

  test("guest AI generate auto-saves to public gallery feed", async ({ page, request }) => {
    const title = `e2e public feed ${Date.now()}`;
    await page.goto("/studio");
    await page.getByPlaceholder(/Describe the image/i).fill(title);
    await clickCookUp(page);
    await expect(page.getByText(/on the gallery/i)).toBeVisible({ timeout: 30000 });
    const feed = await request.get("/api/posts?sort=newest");
    expect(feed.ok()).toBeTruthy();
    const data = await feed.json();
    const hit = (data.items ?? []).some((p: { title: string }) => p.title === title);
    expect(hit).toBe(true);
  });

  test("signed-in private AI generate stays off public gallery feed", async ({ page, request }) => {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    const title = `e2e private feed ${Date.now()}`;
    await page.goto("/studio");
    await page.getByText("More options").click();
    await page.getByTestId("studio-visibility-private").check();
    await page.getByPlaceholder(/Describe the image/i).fill(title);
    await clickCookUp(page);
    await expect(page.getByText(/won't show on the public gallery/i)).toBeVisible({ timeout: 30000 });
    const feed = await request.get("/api/posts?sort=newest");
    const data = await feed.json();
    const hit = (data.items ?? []).some((p: { title: string }) => p.title === title);
    expect(hit).toBe(false);
  });

  test("studio refine: manual editor and assist apply change", async ({ page }) => {
    await page.goto("/studio");
    await page.getByPlaceholder(/Describe the image/i).fill("ember plate test");
    await clickCookUp(page);
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Open editor" }).click();
    await page.getByRole("button", { name: "Cancel" }).click();
    await page.getByRole("checkbox", { name: /Assist/i }).check();
    await page.getByRole("button", { name: "Brighten" }).click();
    await expect(page.getByTestId("ai-edit-preview")).toBeVisible({ timeout: 20000 });
    await page.getByRole("button", { name: /Keep this version/i }).click();
    await expect(page.getByTestId("ai-edit-preview")).toHaveCount(0, { timeout: 20000 });
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible();
    await expect(page.getByText(/couldn't finish that image/i)).toHaveCount(0);
  });

  test("studio assist: free-text content edit shows preview", async ({ page }) => {
    await page.goto("/studio");
    await page.getByPlaceholder(/Describe the image/i).fill("ember meadow test");
    await clickCookUp(page);
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible({ timeout: 30000 });
    await page.getByRole("checkbox", { name: /Assist/i }).check();
    await page.getByTestId("studio-assist-prompt").fill("add fairies");
    await page.getByRole("button", { name: /Apply change/i }).click();
    await expect(page.getByTestId("ai-edit-preview")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/couldn't apply that change/i)).toHaveCount(0);
  });

  test("guest uploaded image handoff to studio refine", async ({ page, request }) => {
    await page.goto("/studio");
    await page.locator("summary").filter({ hasText: "Bring your own image" }).click();
    await page.locator('input[type="file"]').setInputFiles(png);
    await expect(page.getByText(/Ready in the studio/i)).toBeVisible({ timeout: 15000 });
    await page.getByRole("navigation", { name: "Studio steps" }).getByRole("button", { name: "Share" }).click();
    const pageLink = await page.locator('input[readonly][value*="/i/"]').first().inputValue();
    const shortId = pageLink.match(/\/i\/([^/?#]+)/)?.[1];
    expect(shortId).toBeTruthy();
    await page.goto(`/i/${shortId}`);
    await page.getByRole("link", { name: /Refine in studio/i }).click();
    await expect(page.getByRole("button", { name: /Open editor/i })).toBeVisible();
    await page.getByRole("button", { name: /Open editor/i }).click();
    await page.getByRole("button", { name: /Save to studio/i }).click();
    await expect(page.getByRole("button", { name: /Open editor/i })).toBeVisible({ timeout: 15000 });
    const fileRes = await request.get(`/api/media/${shortId}`);
    const meta = await fileRes.json();
    const fileBytes = await request.get(
      `/api/media/file/${meta.storageKey}?mime=${encodeURIComponent(meta.mimeType)}`,
    );
    expect(fileBytes.status()).toBe(200);
  });

  test("signed-in generate refine share to gallery", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    await page.goto("/studio");
    await page.getByPlaceholder(/Describe the image/i).fill("gallery e2e dish");
    await clickCookUp(page);
    await expect(page.locator('main img[src*="/api/media/file/"]').first()).toBeVisible({ timeout: 30000 });
    await page.getByRole("navigation", { name: "Studio steps" }).getByRole("button", { name: "Share" }).click();
    await page.getByLabel("Title").fill(`Studio dish ${Date.now()}`);
    await page.getByRole("button", { name: /Serve to gallery/i }).click();
    await page.waitForURL(/\/p\//, { timeout: 15000 });
    await expect(page.locator('img[src*="/api/media/file/"]')).toBeVisible();
    await expect(page.getByRole("link", { name: /Refine in studio/i })).toBeVisible();
    await page.getByRole("link", { name: /Refine in studio/i }).click();
    await expect(page.getByRole("button", { name: /Open editor/i })).toBeVisible();
  });

  test("admin: e2eadmin sees Admin link and loads console", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2eadmin@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible({ timeout: 15000 });
    await page.goto("/admin");
    await expect(page.getByRole("heading", { name: /Super admin/i })).toBeVisible();
    await page.getByRole("button", { name: "Site" }).click();
    await page.getByRole("button", { name: "Save settings" }).click();
    await expect(page.getByText(/Site settings saved/i)).toBeVisible();
  });

  test("admin: normal user and guest get 404", async ({ page, request }) => {
    const anon = await request.get("/api/admin/dashboard");
    expect(anon.status()).toBe(404);
    await page.goto("/admin");
    await expect(page.getByText(/not found|404/i)).toBeVisible();

    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
    const res = await request.get("/api/admin/dashboard");
    expect(res.status()).toBe(404);
  });

  test("unique viewers and cheese spice meter on public post", async ({ page, request, browser }) => {
    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    const createRes = await request.post("/api/posts", {
      multipart: {
        title: `Public views ${Date.now()}`,
        visibility: "PUBLIC",
        files: {
          name: "tiny.png",
          mimeType: "image/png",
          buffer: await fs.readFile(png),
        },
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const { shortId } = await createRes.json();
    expect(shortId).toBeTruthy();

    const ownerRes = await request.get(`/api/posts/${shortId}`);
    const ownerJson = await ownerRes.json();
    expect(ownerJson.viewCount).toBe(0);

    const anonA = await browser.newContext();
    const anonReq = anonA.request;
    const r1 = await anonReq.get(`/api/posts/${shortId}`);
    const j1 = await r1.json();
    expect(j1.viewCount).toBe(1);
    expect(j1.spiceScore).toBeGreaterThanOrEqual(1);

    const r2 = await anonReq.get(`/api/posts/${shortId}`);
    const j2 = await r2.json();
    expect(j2.viewCount).toBe(1);
    expect(j2.spiceScore).toBeGreaterThan(j1.spiceScore);

    await page.goto(`/p/${shortId}`);
    await expect(page.getByTestId("cheese-spice-gauge")).toBeVisible();
    await expect(page.getByText("COOK COUNT", { exact: true })).toBeVisible();
    await expect(page.getByText(/Each cook counts once/i)).toHaveCount(0);
    await page.locator("[data-testid=cheese-spice-gauge]").screenshot({
      path: "/opt/cursor/artifacts/screenshots/cook-count-flame-gauge.png",
    });
    await expect(page.getByText(/Cheese pull/i)).toBeVisible();
    await expect(page.getByText(/spicy meter/i)).toHaveCount(0);
    await expect(page.getByText(/Extra passes and guest buzz/i)).toHaveCount(0);
    await anonA.close();
  });

  test("sign up, sign in, private post enforcement", async ({ page, context }) => {
    const email = `e2e_${Date.now()}@imbrgr.test`;
    const username = `e2e${Date.now().toString().slice(-6)}`;
    await page.goto("/auth/signup");
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/username/i).fill(username);
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign up|create/i }).click();
    await page.waitForURL(/signin|upload|\/$/);

    await page.goto("/auth/signin");
    await page.getByPlaceholder(/email/i).fill(email);
    await page.getByPlaceholder(/password/i).fill("password12345");
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });

    await page.goto("/upload");
    await page.locator('input[type="file"]').setInputFiles(png);
    await page.getByLabel("Title").fill("Private e2e post");
    await page.getByRole("radio", { name: /Private/i }).check();
    await page.getByRole("button", { name: /Serve it hot/i }).click();
    await page.waitForURL(/\/p\//);
    const postUrl = page.url();

    const anon = await context.browser()?.newContext();
    const anonPage = await anon!.newPage();
    await anonPage.goto(postUrl);
    await expect(anonPage.getByText(/private or does not exist/i)).toBeVisible({ timeout: 15000 });
    await anon?.close();
  });
});
