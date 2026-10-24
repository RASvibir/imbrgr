import { describe, it, expect, vi } from "vitest";
import { createSampleBurgerFile, drawSampleBurger } from "./sample-image";

describe("Sample image generator", () => {
  it("creates a valid File object", async () => {
    const file = await createSampleBurgerFile();
    expect(file).toBeInstanceOf(File);
    expect(file.name).toBe("imbrgr-burger-sample.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBeGreaterThan(0);
  });

  it("drawSampleBurger invokes 2D canvas drawing methods deterministically", () => {
    const mockCtx = {
      clearRect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      bezierCurveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      arc: vi.fn(),
      ellipse: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      fillText: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    } as unknown as CanvasRenderingContext2D;

    expect(() => drawSampleBurger(mockCtx, 640, 640)).not.toThrow();
    expect(mockCtx.clearRect).toHaveBeenCalledWith(0, 0, 640, 640);
    expect(mockCtx.createRadialGradient).toHaveBeenCalled();
    expect(mockCtx.createLinearGradient).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalledWith(
      "🔥 imbrgr sample",
      expect.any(Number),
      expect.any(Number),
    );
  });
});
