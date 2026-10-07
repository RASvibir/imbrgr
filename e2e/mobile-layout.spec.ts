import { test, expect } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";
import {
  auditMobileLayout,
  MOBILE_VIEWPORTS,
} from "./mobile-layout-helpers";

const png = path.join(__dirname, "fixtures/tiny.png");
const artifactsDir = "/opt/cursor/artifacts/screenshots";

async function signInUser(page: import("@playwright/test").Page) {
  await page.goto("/auth/signin");
  await page.getByPlaceholder(/email/i).fill("e2euser@imbrgr.test");
  await page.getByPlaceholder(/password/i).fill("password12345");
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15000 });
}

for (const vp of MOBILE_VIEWPORTS) {
  test.describe(`mobile layout ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    test("home passes layout audit", async ({ page }) => {
      await page.goto("/");
      await auditMobileLayout(page);
      if (vp.name === "390x844") {
        await page.screenshot({ path: `${artifactsDir}/mobile-home-390.png`, fullPage: true });
      }
    });

    test("studio create and refine assist", async ({ page }) => {
      await page.goto("/studio");
      await auditMobileLayout(page);
      if (vp.name === "390x844") {
        await page.screenshot({ path: `${artifactsDir}/mobile-studio-create-390.png`, fullPage: true });
      }
      await page.getByPlaceholder(/Describe the image/i).fill("ember snack");
      await page.getByRole("button", { name: /Cook up image/i }).first().click();
      await expect(page.getByText(/Ready in the studio/i)).toBeVisible({ timeout: 20000 });
      await page.getByRole("navigation", { name: "Studio steps" }).getByRole("button", { name: "Refine" }).click();
      await page.getByRole("checkbox", { name: /Assist/i }).check();
      await auditMobileLayout(page);
      if (vp.name === "390x844") {
        await page.screenshot({ path: `${artifactsDir}/mobile-studio-refine-assist-390.png`, fullPage: true });
      }
      await page.getByRole("navigation", { name: "Studio steps" }).getByRole("button", { name: "Share" }).click();
      await auditMobileLayout(page);
      if (vp.name === "390x844") {
        await page.screenshot({ path: `${artifactsDir}/mobile-studio-share-390.png`, fullPage: true });
      }
    });

    test("hot and mobile nav menu", async ({ page }) => {
      await page.goto("/hot");
      await auditMobileLayout(page);
      if (vp.name === "390x844") {
        await page.screenshot({ path: `${artifactsDir}/mobile-hot-390.png`, fullPage: true });
      }
      await page.getByTestId("mobile-nav-more").click();
      await expect(page.getByTestId("mobile-nav-menu")).toBeVisible();
      await auditMobileLayout(page);
      if (vp.name === "390x844") {
        await page.screenshot({ path: `${artifactsDir}/mobile-nav-menu-390.png`, fullPage: true });
      }
    });
  });
}

test.describe("mobile layout post and profile", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("post page with remix and report", async ({ page, request }) => {
    await signInUser(page);
    const createRes = await request.post("/api/posts", {
      multipart: {
        title: `Mobile layout ${Date.now()}`,
        visibility: "PUBLIC",
        files: {
          name: "tiny.png",
          mimeType: "image/png",
          buffer: await fs.readFile(png),
        },
      },
    });
    const { shortId } = await createRes.json();
    await page.goto(`/p/${shortId}`);
    await auditMobileLayout(page);
    await page.screenshot({ path: `${artifactsDir}/mobile-post-remix-390.png`, fullPage: true });
    await page.getByRole("button", { name: "Report" }).click();
    await auditMobileLayout(page);
  });

  test("profile page", async ({ page }) => {
    await signInUser(page);
    await page.goto("/u/e2euser");
    await auditMobileLayout(page);
    await page.screenshot({ path: `${artifactsDir}/mobile-profile-390.png`, fullPage: true });
  });
});
