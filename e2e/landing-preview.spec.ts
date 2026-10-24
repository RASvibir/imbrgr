import { test, expect } from "@playwright/test";

test.describe("Landing Preview (/landing-preview)", () => {
  test("loads landing preview with headline and hero dropzone", async ({ page }) => {
    const res = await page.goto("/landing-preview");
    expect(res?.status()).toBe(200);

    await expect(page.getByTestId("landing-preview-page")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Make something fun in 10 seconds",
    );
    await expect(page.getByTestId("hero-dropzone")).toBeVisible();
    await expect(page.getByTestId("hero-sample-button")).toBeVisible();
  });

  test("generates procedural sample burger and displays instant result rail", async ({
    page,
  }) => {
    await page.goto("/landing-preview");

    // Click 'Use a sample'
    await page.getByTestId("hero-sample-button").click();

    // Result rail should appear
    const rail = page.getByTestId("result-rail");
    await expect(rail).toBeVisible();

    // Verify all 5 result cards
    const memeCard = page.getByTestId("result-card-meme");
    const gifCard = page.getByTestId("result-card-gif");
    const collageCard = page.getByTestId("result-card-collage");
    const filterCard = page.getByTestId("result-card-filter");
    const arCard = page.getByTestId("result-card-ar");

    await expect(memeCard).toBeVisible();
    await expect(gifCard).toBeVisible();
    await expect(collageCard).toBeVisible();
    await expect(filterCard).toBeVisible();
    await expect(arCard).toBeVisible();

    // Check that links contain ?from=landing and &handoff=
    await expect(memeCard).toHaveAttribute("href", /from=landing(&handoff=.+)?/);
    await expect(gifCard).toHaveAttribute("href", /from=landing(&handoff=.+)?/);
    await expect(collageCard).toHaveAttribute("href", /from=landing(&handoff=.+)?/);
    await expect(filterCard).toHaveAttribute("href", /from=landing(&handoff=.+)?/);
    await expect(arCard).toHaveAttribute("href", /from=landing(&handoff=.+)?/);

    // Switch fun filter pill
    const meltBtn = page.getByRole("button", { name: /🧀 Melt/i });
    await expect(meltBtn).toBeVisible();
    await meltBtn.click();
  });

  test("renders 6 outcome-driven tiles with lightweight canvas previews", async ({
    page,
  }) => {
    await page.goto("/landing-preview");

    const section = page.getByTestId("outcome-tiles-section");
    await expect(section).toBeVisible();

    const expectedTools = ["meme", "gif", "collage", "style", "ar", "ai"];
    for (const toolId of expectedTools) {
      const tile = page.getByTestId(`outcome-tile-${toolId}`);
      await expect(tile).toBeVisible();
      // Ensure canvas preview element is present
      await expect(tile.locator("canvas")).toBeVisible();
      // Ensure primary call to action button is present
      await expect(tile.getByRole("link")).toBeVisible();
    }
  });

  test("renders 'Pick, tweak, share' three-step strip", async ({ page }) => {
    await page.goto("/landing-preview");

    const strip = page.getByTestId("three-step-strip");
    await expect(strip).toBeVisible();
    await expect(strip).toContainText("Pick, tweak, share.");
    await expect(strip).toContainText("No account needed to try");
    await expect(strip).toContainText("Pick or Drop");
    await expect(strip).toContainText("Tweak Live");
    await expect(strip).toContainText("Save & Share");
  });

  test("renders gallery proof section with sort tabs", async ({ page }) => {
    await page.goto("/landing-preview");

    const gallery = page.getByTestId("gallery-proof-section");
    await expect(gallery).toBeVisible();
    await expect(gallery).toContainText("Cooked by the community");

    // Click sort tabs
    const freshTab = page.getByRole("tab", { name: /Freshly Cooked/i });
    await expect(freshTab).toBeVisible();
    await freshTab.click();
    await expect(freshTab).toHaveAttribute("aria-selected", "true");

    const topTab = page.getByRole("tab", { name: /Top Rated/i });
    await expect(topTab).toBeVisible();
    await topTab.click();
    await expect(topTab).toHaveAttribute("aria-selected", "true");
  });

  test("mobile view (360px) displays sticky bottom action bar and collapses dropzone", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto("/landing-preview");

    // Sticky bottom action bar
    const bar = page.getByTestId("mobile-action-bar");
    await expect(bar).toBeVisible();
    await expect(page.getByTestId("mobile-action-meme")).toBeVisible();
    await expect(page.getByTestId("mobile-action-gif")).toBeVisible();
    await expect(page.getByTestId("mobile-action-ar")).toBeVisible();
    await expect(page.getByTestId("mobile-action-create")).toBeVisible();

    // Collapsed mobile hero action
    await expect(page.getByTestId("hero-mobile-upload")).toBeVisible();
    await expect(page.getByTestId("hero-mobile-sample-button")).toBeVisible();

    // Verify no horizontal overflow
    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const clientWidth = await page.evaluate(
      () => document.documentElement.clientWidth,
    );
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
  });
});
