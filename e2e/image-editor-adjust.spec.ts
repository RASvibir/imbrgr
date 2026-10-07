import { test, expect } from "@playwright/test";
import path from "node:path";

const png = path.join(__dirname, "fixtures/tiny.png");
const artifactsDir = "/opt/cursor/artifacts/screenshots";
const DESKTOP = { width: 1280, height: 800 };

async function setRange(page: import("@playwright/test").Page, testId: string, value: number) {
  await page.getByTestId(testId).evaluate((el, v) => {
    const input = el as HTMLInputElement;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
    setter.call(input, String(v));
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  }, value);
}

test.describe("image editor sliders & draw @ desktop", () => {
  test.use({ viewport: DESKTOP });

  test("studio: slider preview, undo, touch-up, draw color", async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto("/");
    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes("/api/studio/import") && r.status() === 200,
        { timeout: 20000 },
      ),
      page.getByTestId("home-upload-input").setInputFiles(png),
    ]);
    await expect(page).toHaveURL(/tab=refine/, { timeout: 20000 });
    await page.getByTestId("studio-open-editor").click();
    await expect(page.getByTestId("image-editor")).toBeVisible();

    const cropper = page.getByTestId("image-editor-cropper");
    const rev0 = await cropper.getAttribute("data-preview-rev");
    await expect(page.getByTestId("image-editor-undo")).toBeDisabled();

    await setRange(page, "image-editor-slider-saturation", 40);
    await expect
      .poll(async () => cropper.getAttribute("data-preview-rev"), { timeout: 15000 })
      .not.toBe(rev0);
    await expect(page.getByTestId("image-editor-undo")).toBeEnabled();

    await page.getByTestId("image-editor-undo").click();
    await expect(page.getByTestId("image-editor-undo")).toBeDisabled();
    await expect(page.getByTestId("image-editor-slider-saturation")).toHaveValue("100");

    await page.getByTestId("image-editor-touchup-auto").click();
    await expect(page.getByTestId("image-editor-undo")).toBeEnabled();
    const revAuto = await cropper.getAttribute("data-preview-rev");
    expect(revAuto).not.toBe(rev0);

    await page.getByTestId("image-editor-draw-color-sky").click();
    const canvas = page.getByTestId("image-editor-draw-canvas");
    const box = await canvas.boundingBox();
    expect(box).toBeTruthy();
    await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const rect = c.getBoundingClientRect();
      const y = rect.top + rect.height * 0.5;
      const x1 = rect.left + rect.width * 0.25;
      const x2 = rect.left + rect.width * 0.75;
      c.dispatchEvent(new PointerEvent("pointerdown", { clientX: x1, clientY: y, bubbles: true, pointerId: 1 }));
      c.dispatchEvent(new PointerEvent("pointermove", { clientX: x2, clientY: y, bubbles: true, pointerId: 1 }));
      c.dispatchEvent(new PointerEvent("pointerup", { clientX: x2, clientY: y, bubbles: true, pointerId: 1 }));
    });

    const strokeBlue = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext("2d");
      if (!ctx) return false;
      const { data, width, height } = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] > 0 && data[i + 2] > data[i] + 20) return true;
      }
      return false;
    });
    expect(strokeBlue).toBe(true);

    await page.screenshot({ path: `${artifactsDir}/image-editor-studio-draw-1280.png`, fullPage: false });
    await page.getByTestId("image-editor-undo").click();
    const strokeAfterUndo = await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext("2d");
      if (!ctx) return true;
      const { data } = ctx.getImageData(0, 0, c.width, c.height);
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] > 0) return false;
      }
      return true;
    });
    expect(strokeAfterUndo).toBe(true);
  });
});
