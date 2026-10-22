import { describe, expect, it } from "vitest";
import { computeFrameRects, normalizeClipRange } from "@/lib/media-studio-layout";

describe("media studio layout", () => {
  it("builds side-by-side slots", () => {
    const rects = computeFrameRects({
      layout: "side-by-side",
      count: 2,
      canvasWidth: 1200,
      canvasHeight: 600,
      spacing: 20,
    });
    expect(rects).toHaveLength(2);
    expect(rects[0].width).toBe(590);
    expect(rects[1].x).toBe(610);
  });

  it("builds pip slots with overlays", () => {
    const rects = computeFrameRects({
      layout: "pip",
      count: 3,
      canvasWidth: 1000,
      canvasHeight: 800,
      spacing: 16,
    });
    expect(rects[0]).toMatchObject({ x: 0, y: 0, width: 1000, height: 800 });
    expect(rects[1].width).toBeGreaterThan(100);
    expect(rects[1].zIndex).toBeGreaterThan(rects[0].zIndex);
  });

  it("normalizes clip ranges", () => {
    expect(normalizeClipRange(10, -1, 2)).toEqual({ startSec: 0, endSec: 2, durationSec: 2 });
    expect(normalizeClipRange(10, 9.99, 9.995).durationSec).toBeGreaterThanOrEqual(0.05);
  });
});
