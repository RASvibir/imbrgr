import { test, expect } from "@playwright/test";
import path from "node:path";

const spotted = path.join(__dirname, "fixtures/spotted.png");
const artifactsDir = "/opt/cursor/artifacts/screenshots";
const DESKTOP = { width: 1280, height: 800 };

async function openStudioEditor(page: import("@playwright/test").Page, file: string) {
  await page.goto("/");
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/studio/import") && r.status() === 200,
      { timeout: 30000 },
    ),
    page.getByTestId("home-upload-input").setInputFiles(file),
  ]);
  await expect(page).toHaveURL(/tab=refine/, { timeout: 30000 });
  await expect(page.getByTestId("studio-open-editor")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("studio-open-editor").click();
  await expect(page.getByTestId("image-editor")).toBeVisible();
}

async function previewSample(
  page: import("@playwright/test").Page,
  nx = 0.5,
  ny = 0.5,
): Promise<number[]> {
  return page.evaluate(({ nx, ny }) => {
    const img = document.querySelector(
      '[data-testid="image-editor-cropper"] img',
    ) as HTMLImageElement | null;
    if (!img?.complete || !img.naturalWidth) return [];
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [];
    ctx.drawImage(img, 0, 0);
    const cx = Math.floor(canvas.width * nx);
    const cy = Math.floor(canvas.height * ny);
    const r = 8;
    const pixels: number[] = [];
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = ctx.getImageData(x, y, 1, 1).data;
        pixels.push(d[0], d[1], d[2]);
      }
    }
    return pixels;
  }, { nx, ny });
}

function avgDiff(a: number[], b: number[]): number {
  if (a.length !== b.length || !a.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
}

test.describe("spot fix & eraser undo @ desktop", () => {
  test.use({ viewport: DESKTOP });

  test("spot fix heals blemish in studio preview", async ({ page }) => {
    test.setTimeout(120_000);
    await openStudioEditor(page, spotted);
    const before = await previewSample(page, 0.5, 0.5);
    expect(before.length).toBeGreaterThan(0);

    await page.getByTestId("image-editor-tool-spot").click();
    const cropper = page.getByTestId("image-editor-cropper");
    const canvas = page.getByTestId("image-editor-draw-canvas");
    const rev0 = await cropper.getAttribute("data-preview-rev");
    await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const img = c.parentElement?.querySelector("img");
      if (!img) return;
      const rect = img.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      c.dispatchEvent(new PointerEvent("pointerdown", { clientX: cx, clientY: cy, bubbles: true, pointerId: 3 }));
    });
    await expect(page.getByTestId("image-editor-undo")).toBeEnabled({ timeout: 10000 });
    await expect
      .poll(async () => cropper.getAttribute("data-preview-rev"), { timeout: 15000 })
      .not.toBe(rev0);

    await expect
      .poll(async () => avgDiff(before, await previewSample(page, 0.5, 0.5)), { timeout: 15000 })
      .toBeGreaterThan(4);

    await page.screenshot({ path: `${artifactsDir}/image-editor-spot-fix-1280.png`, fullPage: false });
  });

  test("eraser stroke undo restores draw layer in preview", async ({ page }) => {
    test.setTimeout(120_000);
    await openStudioEditor(page, spotted);
    await page.getByTestId("image-editor-draw-color-coal").click();
    await page.getByTestId("image-editor-brush-size").evaluate((el) => {
      const input = el as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(input, "24");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    const canvas = page.getByTestId("image-editor-draw-canvas");
    await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const rect = c.getBoundingClientRect();
      const y = rect.top + rect.height * 0.4;
      const x1 = rect.left + rect.width * 0.2;
      const x2 = rect.left + rect.width * 0.8;
      c.dispatchEvent(new PointerEvent("pointerdown", { clientX: x1, clientY: y, bubbles: true, pointerId: 1 }));
      c.dispatchEvent(new PointerEvent("pointermove", { clientX: x2, clientY: y, bubbles: true, pointerId: 1 }));
      c.dispatchEvent(new PointerEvent("pointerup", { clientX: x2, clientY: y, bubbles: true, pointerId: 1 }));
    });

    const inkAt = async () =>
      canvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const ctx = c.getContext("2d");
        if (!ctx) return 0;
        const y = Math.floor(c.height * 0.4);
        let max = 0;
        for (let x = Math.floor(c.width * 0.3); x <= Math.floor(c.width * 0.7); x++) {
          max = Math.max(max, ctx.getImageData(x, y, 1, 1).data[3]);
        }
        return max;
      });
    expect(await inkAt()).toBeGreaterThan(0);

    const inkBeforeErase = await inkAt();
    await page.getByTestId("image-editor-tool-eraser").click();
    await expect(page.getByTestId("image-editor")).toHaveAttribute("data-active-tool", "eraser");
    await canvas.evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const rect = c.getBoundingClientRect();
      const y = rect.top + rect.height * 0.4;
      const x1 = rect.left + rect.width * 0.25;
      const x2 = rect.left + rect.width * 0.75;
      c.dispatchEvent(
        new PointerEvent("pointerdown", { clientX: x1, clientY: y, bubbles: true, pointerId: 5, pointerType: "mouse" }),
      );
      const ctx = c.getContext("2d")!;
      const cy = Math.floor(c.height * 0.4);
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,1)";
      for (let x = Math.floor(c.width * 0.2); x < Math.floor(c.width * 0.8); x += 4) {
        ctx.beginPath();
        ctx.arc(x, cy, 16, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      c.dispatchEvent(
        new PointerEvent("pointerup", { clientX: x2, clientY: y, bubbles: true, pointerId: 5, pointerType: "mouse" }),
      );
    });

    await expect.poll(inkAt, { timeout: 5000 }).toBeLessThan(inkBeforeErase / 2);

    await page.getByTestId("image-editor-undo").click();
    await expect.poll(inkAt, { timeout: 15000 }).toBeGreaterThan(inkBeforeErase / 2);

    await page.screenshot({ path: `${artifactsDir}/image-editor-eraser-undo-1280.png`, fullPage: false });
  });
});
