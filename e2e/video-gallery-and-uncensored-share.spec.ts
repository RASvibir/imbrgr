import { expect, test, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const tinyPng = path.join(__dirname, "fixtures/tiny.png");

async function signUpAndSignIn(page: Page, suffix: string): Promise<{ username: string; email: string }> {
  const username = `u_${suffix}`.slice(0, 24);
  const email = `${username}@imbrgr.test`;
  const password = "password12345";

  const signup = await page.request.post("/api/auth/signup", {
    data: { email, username, password },
  });
  expect(signup.status()).toBe(200);

  await page.goto("/auth/signin");
  await page.getByPlaceholder(/email/i).fill(email);
  await page.getByPlaceholder(/password/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.includes("/auth/signin"), { timeout: 15_000 });
  return { username, email };
}

test.describe("Video gallery saving & settings-hamburger uncensored share portal", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("saves generated AI video clips and uploaded video-only posts to the gallery", async ({
    page,
  }) => {
    await page.goto("/studio?tab=video");

    const promptInput = page.getByTestId("ai-video-prompt-input");
    const uniqueTitle = `sizzling ramen ${Date.now()}`;
    await promptInput.fill(uniqueTitle);

    await page.getByTestId("ai-video-generate-button").click();
    const saveGalleryBtn = page.getByTestId("ai-video-save-gallery");
    await expect(saveGalleryBtn).toBeVisible({ timeout: 25_000 });
    await saveGalleryBtn.click();

    const savedLink = page.getByTestId("ai-video-saved-link");
    await expect(savedLink).toBeVisible({ timeout: 15_000 });
    const href = await savedLink.getAttribute("href");
    expect(href).toMatch(/^\/p\/.+/);

    await page.goto(href!);
    await expect(page.getByRole("heading", { name: uniqueTitle })).toBeVisible();

    // Direct video-only post upload should also load on /p/[shortId] and appear in feed
    const videoUpload = await page.request.post("/api/posts", {
      multipart: {
        title: `video only ${Date.now()}`,
        visibility: "PUBLIC",
        files: {
          name: "clip.mp4",
          mimeType: "video/mp4",
          buffer: Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex"),
        },
      },
    });
    expect(videoUpload.status()).toBe(200);
    const { shortId: videoPostId } = (await videoUpload.json()) as { shortId: string };

    const videoPostRes = await page.goto(`/p/${videoPostId}`);
    expect(videoPostRes?.status()).toBe(200);
    await expect(page.locator("video")).toBeVisible();

    const feedRes = await page.request.get("/api/posts?sort=newest");
    expect(feedRes.status()).toBe(200);
    const feedIds = ((await feedRes.json()) as { items: { shortId: string }[] }).items.map(
      (p) => p.shortId,
    );
    expect(feedIds).toContain(videoPostId);
  });

  test("uncensored share lives in the settings hamburger and enforces server-side 18+ age checks", async ({
    page,
    browser,
  }) => {
    const tag = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const { username } = await signUpAndSignIn(page, tag);

    // Public pages and public profile must not surface adult portal links
    await page.goto("/");
    await expect(page.getByTestId("menu-uncensored-share")).toHaveCount(0);
    await page.goto(`/u/${username}`);
    await expect(page.getByText(/uncensored share/i)).toHaveCount(0);

    // Create a mature post as the signed-in user
    const matureTitle = `uncensored study ${tag}`;
    const created = await page.request.post("/api/posts", {
      multipart: {
        title: matureTitle,
        mature: "true",
        visibility: "PUBLIC",
        files: { name: "tiny.png", mimeType: "image/png", buffer: fs.readFileSync(tinyPng) },
      },
    });
    expect(created.status()).toBe(200);
    const { shortId: matureShortId } = (await created.json()) as { shortId: string };

    const postMeta = (await (await page.request.get(`/api/posts/${matureShortId}`)).json()) as {
      viewerAgeVerified: boolean;
      media: { storageKey: string; mature: boolean }[];
    };
    expect(postMeta.viewerAgeVerified).toBe(false);
    expect(postMeta.media[0]?.mature).toBe(true);
    expect(postMeta.media[0]?.storageKey).toBe("");

    // Signed-out guest hits the sign-in / age gate on both portal and direct post link
    const guestCtx = await browser.newContext();
    const guestPortalApi = await guestCtx.request.get(
      new URL(`/api/users/${username}/mature`, "http://127.0.0.1:3000").toString(),
    );
    expect(guestPortalApi.status()).toBe(401);

    const guestPage = await guestCtx.newPage();
    await guestPage.goto(`/u/${username}/mature`);
    await expect(guestPage.getByTestId("age-gate-signin")).toBeVisible();
    await guestPage.goto(`/p/${matureShortId}`);
    await expect(guestPage.getByTestId("age-gate-signin")).toBeVisible();
    await guestCtx.close();

    // Creator opens the hamburger menu -> Uncensored share (18+)
    await page.goto("/");
    await page.getByTestId("header-overflow-menu").click();
    const menuLink = page.getByTestId("menu-uncensored-share");
    await expect(menuLink).toBeVisible();
    await menuLink.click();
    await expect(page).toHaveURL(new RegExp(`/u/${username}/mature$`), { timeout: 10_000 });

    // Unverified account hits the 18+ age gate first; underage submission is rejected
    await expect(page.getByTestId("age-gate-card")).toBeVisible();
    await page.getByTestId("age-gate-birthdate").fill("2015-05-01");
    await page.getByTestId("age-gate-confirm").check();
    await page.getByTestId("age-gate-submit").click();
    await expect(page.getByTestId("age-gate-error")).toContainText(/18 years old/i);

    // Valid 18+ verification unlocks the portal and the mature post
    await page.getByTestId("age-gate-birthdate").fill("1992-05-20");
    await page.getByTestId("age-gate-submit").click();
    await expect(page.getByTestId("mature-share-portal")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(matureTitle)).toBeVisible();

    await page.goto(`/p/${matureShortId}`);
    await expect(page.getByTestId("age-gate-card")).toHaveCount(0);
    await expect(page.getByTestId("post-media-image")).toBeVisible();
  });
});
