import { expect, test } from "@playwright/test";

test.describe("Studio Video Prompt Assist (/studio?tab=video)", () => {
  test("counter, improve, accept, undo, variants, and auto-improve prompt used", async ({
    page,
  }) => {
    await page.goto("/studio?tab=video");
    await expect(page.getByTestId("video-generator-panel")).toBeVisible();

    const input = page.getByTestId("ai-video-prompt-input");
    const counter = page.getByTestId("prompt-char-counter");
    await expect(counter).toContainText("0/500");

    // Near-limit warning and maxLength 500 enforcement
    await input.fill("a".repeat(430));
    await expect(counter).toContainText("430/500");
    await expect(page.getByTestId("prompt-char-warning")).toContainText(/near limit/i);

    await input.fill("b".repeat(520));
    await expect(input).toHaveValue("b".repeat(500));
    await expect(counter).toContainText("500/500");
    await expect(page.getByTestId("prompt-char-warning")).toContainText(/limit reached/i);

    // Improve -> Accept -> Undo (unique prompt per run so AiPromptCache never turns "local" into "cache")
    const runTag = Math.random().toString(36).slice(2, 8);
    const originalPrompt = `2 red cats without collars ${runTag}`;
    await input.fill(originalPrompt);
    await expect(counter).toContainText(`${originalPrompt.length}/500`);

    await page.getByTestId("improve-prompt-button").click();
    const resultCard = page.getByTestId("prompt-assist-result");
    await expect(resultCard).toBeVisible();
    await expect(page.getByTestId("prompt-assist-original")).toContainText(originalPrompt);
    await expect(page.getByTestId("prompt-assist-improved")).toContainText(originalPrompt);
    await expect(page.getByTestId("prompt-preserved-chips")).toBeVisible();
    await expect(page.getByTestId("prompt-added-chips")).toBeVisible();

    const improvedText = (
      await page.getByTestId("prompt-assist-improved").locator("p").nth(1).textContent()
    )?.trim();
    expect(improvedText).toBeTruthy();
    expect(improvedText!.length).toBeGreaterThan(originalPrompt.length);

    await page.getByTestId("prompt-assist-accept").click();
    await expect(resultCard).toBeHidden();
    await expect(input).toHaveValue(improvedText!);
    await expect(page.getByTestId("prompt-assist-undo-bar")).toBeVisible();

    await page.getByTestId("prompt-assist-undo").click();
    await expect(input).toHaveValue(originalPrompt);

    // Variants preset menu + selectable cards
    await page.getByTestId("improve-preset-menu-button").click();
    await expect(page.getByTestId("improve-preset-menu")).toBeVisible();
    await page.getByTestId("improve-preset-variants").click();

    await expect(resultCard).toBeVisible();
    const card0 = page.getByTestId("prompt-variant-card-0");
    const card1 = page.getByTestId("prompt-variant-card-1");
    const card2 = page.getByTestId("prompt-variant-card-2");
    await expect(card0).toBeVisible();
    await expect(card1).toBeVisible();
    await expect(card2).toBeVisible();

    await card1.click();
    await expect(card1).toHaveAttribute("aria-checked", "true");
    const card1Text = (await card1.textContent())?.replace(/^#2\s*/, "").trim();
    await expect(page.getByTestId("prompt-assist-improved")).toContainText(card1Text!);

    await page.getByTestId("prompt-assist-dismiss").click();
    await expect(resultCard).toBeHidden();
    await expect(input).toHaveValue(originalPrompt);

    // Auto-improve toggle ON shows Prompt used after render
    const autoToggle = page.getByTestId("auto-improve-toggle");
    await expect(autoToggle).toBeChecked();

    await page.getByTestId("ai-video-generate-button").click();
    const promptUsedSection = page.getByTestId("prompt-used-section");
    await expect(promptUsedSection).toBeVisible({ timeout: 30_000 });
    const promptUsedText = (await page.getByTestId("prompt-used-text").textContent())?.trim() ?? "";
    expect(promptUsedText).toContain(originalPrompt);
    expect(promptUsedText.length).toBeGreaterThan(originalPrompt.length);
    await expect(page.getByTestId("prompt-used-source")).toContainText(/local/i);

    await page.getByTestId("prompt-used-apply").click();
    await expect(input).toHaveValue(promptUsedText);

    // Auto-improve toggle OFF sends exact user prompt
    await autoToggle.uncheck();
    await input.fill("sunset burger");
    await page.getByTestId("ai-video-generate-button").click();
    await expect(promptUsedSection).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("prompt-used-text")).toHaveText("sunset burger", { timeout: 30_000 });
    await expect(page.getByTestId("prompt-used-source")).toContainText(/user/i, { timeout: 30_000 });
  });
});
