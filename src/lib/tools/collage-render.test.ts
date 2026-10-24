import { describe, it, expect, vi } from "vitest";
import {
  createDefaultCellTransform,
  createInitialCollageState,
  renderCollage,
  BACKGROUND_GRADIENT_PRESETS,
  PHOTO_FILTERS,
} from "./collage-render";

describe("Collage Render Engine", () => {
  it("creates valid initial cell transform and state", () => {
    const transform = createDefaultCellTransform();
    expect(transform.zoom).toBe(1);
    expect(transform.rotation).toBe(0);
    expect(transform.pan).toEqual({ x: 0, y: 0 });
    expect(transform.filterId).toBe("none");

    const state = createInitialCollageState("grid-2x2");
    expect(state.layoutId).toBe("grid-2x2");
    expect(state.cells.length).toBe(4);
    expect(state.aspectRatio).toBe("1:1");
    expect(state.padding).toBe(16);
    expect(state.gap).toBe(12);
    expect(state.cornerRadius).toBe(12);
  });

  it("contains gradient presets and photo filters", () => {
    expect(BACKGROUND_GRADIENT_PRESETS.length).toBeGreaterThanOrEqual(4);
    expect(PHOTO_FILTERS.length).toBeGreaterThanOrEqual(6);

    const emberPreset = BACKGROUND_GRADIENT_PRESETS.find((p) => p.id === "ember");
    expect(emberPreset).toBeDefined();
    expect(emberPreset?.stops.length).toBe(2);
  });

  it("renders state onto canvas without throwing", async () => {
    const mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      rect: vi.fn(),
      fillRect: vi.fn(),
      strokeRect: vi.fn(),
      arc: vi.fn(),
      arcTo: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      clip: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      scale: vi.fn(),
      drawImage: vi.fn(),
      setLineDash: vi.fn(),
      createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      canvas: { width: 1200, height: 1200 },
    };

    const mockCanvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
    } as unknown as HTMLCanvasElement;

    const state = createInitialCollageState("split-v");
    await renderCollage(mockCanvas, state);

    expect(mockCanvas.width).toBe(1200);
    expect(mockCanvas.height).toBe(1200);
    expect(mockCtx.fillRect).toHaveBeenCalled();
  });
});
