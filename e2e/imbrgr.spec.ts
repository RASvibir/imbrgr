import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");

test.describe("imbrgr e2e", () => {
  test("studio page uses consumer-friendly copy", async ({ page }) => {
    await page.goto("/studio");
    const text = (await page.locator("main").innerText()).toLowerCase();
    expect(text).not.toMatch(/pollinations|gemini|ollama|groq|flux|daily ai|token/);
  });

  test("anonymous browse home and studio", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Studio" })).toBeVisible();
    await page.goto("/studio");
    await expect(page.getByRole("heading", { name: /Image studio/i })).toBeVisible();
  });

  test("anonymous studio import and share tab", async ({ page, request }) => {
    await page.goto("/studio");
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
    await page.getByRole("button", { name: "Links" }).click();
    await expect(page.getByText(/Page link/i)).toBeVisible();
  });

  test("anonymous AI generate mock", async ({ page }) => {
    await page.goto("/studio?tab=generate");
    await page.getByPlaceholder(/Describe the image/i).fill("ember burger test");
    await page.getByRole("button", { name: /Cook up image/i }).click();
    await expect(page.getByText(/Ready in the studio/i)).toBeVisible({ timeout: 20000 });
    await expect(page.locator('img[src*="/api/media/file/"]')).toBeVisible();
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
