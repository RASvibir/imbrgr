import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const tinyPng = path.join(__dirname, "fixtures/tiny.png");

test.describe("Studio Video continuation (AI_MOCK)", () => {
  test("supports guest prompt-only Extend and Next shot continuation with honest label and blocks guest last-frame upload", async ({
    page,
  }) => {
    await page.goto("/studio?tab=video");

    const promptInput = page.getByTestId("ai-video-prompt-input");
    await promptInput.fill("neon ramen stand in gentle rain, warm lanterns");

    const generateBtn = page.getByRole("button", { name: /Generate AI Video Clip/i });
    const firstJobPromise = page.waitForResponse(
      (res) => res.url().endsWith("/api/ai/video/jobs") && res.request().method() === "POST",
    );
    await generateBtn.click();
    const firstJobRes = await firstJobPromise;
    expect(firstJobRes.status()).toBe(200);
    const { job: firstJob } = (await firstJobRes.json()) as { job: { id: string } };

    const extendBtn = page.getByTestId("continue-extend");
    const nextShotBtn = page.getByTestId("continue-next-shot");
    await expect(extendBtn).toBeVisible({ timeout: 20_000 });
    await expect(nextShotBtn).toBeVisible();

    // Guest upload to last-frame must be rejected with 401
    const guestUpload = await page.request.post(`/api/ai/video/jobs/${firstJob.id}/last-frame`, {
      multipart: {
        shotIndex: "0",
        file: { name: "tiny.png", mimeType: "image/png", buffer: fs.readFileSync(tinyPng) },
      },
    });
    expect(guestUpload.status()).toBe(401);

    await page.getByRole("button", { name: /\+ Add Clip to Timeline/i }).click();
    await expect(page.getByTestId("video-timeline")).toContainText("00:08.00");

    // Extend keeps the current prompt, disables mature toggle, and continues prompt-only for guests
    await extendBtn.click();
    await expect(page.getByTestId("continue-banner")).toContainText("Extend");
    await expect(promptInput).toHaveValue("neon ramen stand in gentle rain, warm lanterns");

    await generateBtn.click();
    await expect(nextShotBtn).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("continuation-label")).toContainText("continued by prompt, not frame-chained");
    await page.getByRole("button", { name: /\+ Add Clip to Timeline/i }).click();
    await expect(page.getByTestId("video-timeline")).toContainText("00:16.00");

    // Next shot clears the prompt so the user describes what happens next
    await nextShotBtn.click();
    await expect(page.getByTestId("continue-banner")).toContainText("Next shot");
    await expect(promptInput).toHaveValue("");

    await promptInput.fill("chef lifts steaming noodles toward the camera");
    await generateBtn.click();
    await expect(extendBtn).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("continuation-label")).toContainText("continued by prompt, not frame-chained");
    await page.getByRole("button", { name: /\+ Add Clip to Timeline/i }).click();
    await expect(page.getByTestId("video-timeline")).toContainText("00:24.00");
  });
});
