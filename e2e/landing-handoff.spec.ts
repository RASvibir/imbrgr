import { test, expect } from "@playwright/test";
import path from "node:path";

const pngFixture = path.join(__dirname, "fixtures/tiny.png");

test.describe("Landing Handoff to Novelty Tools & Studio", () => {
  test("generates sample image on landing, then opens Meme Maker with handoff", async ({ page }) => {
    await page.goto("/");

    // Click 'Use a sample' to populate dropzone and reveal result rail
    await page.getByTestId("hero-sample-button").click();
    await expect(page.getByTestId("result-rail")).toBeVisible({ timeout: 10000 });

    // Click Meme Maker result card
    const memeCard = page.getByTestId("result-card-meme");
    await expect(memeCard).toBeVisible();
    await memeCard.click();

    // Verify URL and loaded handoff chip
    await expect(page).toHaveURL(/\/tools\/meme\?from=landing&handoff=/);
    const chip = page.getByTestId("loaded-from-drop-chip");
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText("Loaded from your drop");

    // Click clear-to-replace button on the chip
    await page.getByTestId("clear-drop-button").click();
    await expect(chip).toHaveCount(0);
  });

  test("generates sample image on landing, then opens GIF Maker with handoff", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("hero-sample-button").click();
    await expect(page.getByTestId("result-rail")).toBeVisible({ timeout: 10000 });

    const gifCard = page.getByTestId("result-card-gif");
    await expect(gifCard).toBeVisible();
    await gifCard.click();

    await expect(page).toHaveURL(/\/tools\/gif\?from=landing&handoff=/);
    const chip = page.getByTestId("loaded-from-drop-chip");
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText("Loaded from your drop");

    // The GIF Maker should have loaded the frame into its timeline/canvas
    await expect(page.getByTestId("gif-maker-sidebar")).toBeVisible();
  });

  test("generates sample image on landing, then opens Collage Builder with handoff", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("hero-sample-button").click();
    await expect(page.getByTestId("result-rail")).toBeVisible({ timeout: 10000 });

    const collageCard = page.getByTestId("result-card-collage");
    await expect(collageCard).toBeVisible();
    await collageCard.click();

    await expect(page).toHaveURL(/\/tools\/collage\?from=landing&handoff=/);
    const chip = page.getByTestId("loaded-from-drop-chip");
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText("Loaded from your drop");
  });

  test("generates sample image on landing, then opens Photo Filters with handoff", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("hero-sample-button").click();
    await expect(page.getByTestId("result-rail")).toBeVisible({ timeout: 10000 });

    const filterCard = page.getByTestId("result-card-filter");
    await expect(filterCard).toBeVisible();
    await filterCard.click();

    await expect(page).toHaveURL(/\/tools\/filters\?from=landing&handoff=/);
    const chip = page.getByTestId("loaded-from-drop-chip");
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText("Loaded from your drop");
  });

  test("generates sample image on landing, then opens AR Camera with handoff in photo mode", async ({ page }) => {
    await page.goto("/");

    await page.getByTestId("hero-sample-button").click();
    await expect(page.getByTestId("result-rail")).toBeVisible({ timeout: 10000 });

    const arCard = page.getByTestId("result-card-ar");
    await expect(arCard).toBeVisible();
    await arCard.click();

    await expect(page).toHaveURL(/\/tools\/ar\?from=landing&handoff=/);
    const chip = page.getByTestId("loaded-from-drop-chip");
    await expect(chip).toBeVisible({ timeout: 10000 });
    await expect(chip).toContainText("Loaded from your drop");
  });

  test("shows friendly inline note and normal empty state when handoff is missing or expired", async ({ page }) => {
    // Navigate with nonexistent or expired handoff ID
    await page.goto("/tools/meme?from=landing&handoff=nonexistent-id-99999");

    const note = page.getByTestId("handoff-expired-note");
    await expect(note).toBeVisible({ timeout: 10000 });
    await expect(note).toContainText("Your dropped image expired or wasn't found");

    // Normal empty state / template controls should still be fully functional
    await expect(page.getByTestId("tool-shell")).toBeVisible();

    // Dismiss note
    await page.getByTestId("dismiss-expired-button").click();
    await expect(note).toHaveCount(0);
  });

  test("drops actual file from disk onto landing hero and verifies rail appears", async ({ page }) => {
    await page.goto("/");

    // Set fixture file on hero hidden input
    await page.getByTestId("hero-file-input").setInputFiles(pngFixture);

    // Result rail should appear
    await expect(page.getByTestId("result-rail")).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("tiny.png")).toBeVisible();
  });
});
