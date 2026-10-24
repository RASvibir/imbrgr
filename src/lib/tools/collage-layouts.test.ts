import { describe, it, expect } from "vitest";
import {
  COLLAGE_TEMPLATES,
  computeCellRects,
  calculateCollageDimensions,
  getTemplateById,
  type CollageAspect,
} from "./collage-layouts";

describe("Collage Layout Engine", () => {
  it("provides at least 20 layout templates across 2-9 cells", () => {
    expect(COLLAGE_TEMPLATES.length).toBeGreaterThanOrEqual(20);

    const cellCounts = new Set(COLLAGE_TEMPLATES.map((t) => t.cellCount));
    // Verify coverage across cell counts 2 through 9
    for (let c = 2; c <= 9; c++) {
      expect(cellCounts.has(c)).toBe(true);
    }
  });

  it("ensures all template cells have normalized coordinates strictly within [0, 1]", () => {
    for (const tmpl of COLLAGE_TEMPLATES) {
      expect(tmpl.cells.length).toBe(tmpl.cellCount);

      for (const cell of tmpl.cells) {
        expect(cell.x).toBeGreaterThanOrEqual(0);
        expect(cell.y).toBeGreaterThanOrEqual(0);
        expect(cell.width).toBeGreaterThan(0);
        expect(cell.height).toBeGreaterThan(0);
        expect(cell.x + cell.width).toBeLessThanOrEqual(1.0001);
        expect(cell.y + cell.height).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it("correctly computes cell pixel bounds that tile strictly within padding bounds", () => {
    const testCases: { width: number; height: number; padding: number; gap: number }[] = [
      { width: 1000, height: 1000, padding: 20, gap: 10 },
      { width: 800, height: 1200, padding: 30, gap: 16 },
      { width: 1200, height: 675, padding: 0, gap: 0 },
      { width: 400, height: 400, padding: 15, gap: 8 },
    ];

    for (const tc of testCases) {
      for (const tmpl of COLLAGE_TEMPLATES) {
        const rects = computeCellRects(tmpl.cells, {
          collageWidth: tc.width,
          collageHeight: tc.height,
          padding: tc.padding,
          gap: tc.gap,
          cornerRadius: 12,
        });

        expect(rects.length).toBe(tmpl.cells.length);

        for (const rect of rects) {
          // Verify left & top are within padding
          expect(rect.x).toBeGreaterThanOrEqual(tc.padding - 0.01);
          expect(rect.y).toBeGreaterThanOrEqual(tc.padding - 0.01);

          // Verify right & bottom are within outer bounds
          const right = rect.x + rect.width;
          const bottom = rect.y + rect.height;
          expect(right).toBeLessThanOrEqual(tc.width - tc.padding + 0.01);
          expect(bottom).toBeLessThanOrEqual(tc.height - tc.padding + 0.01);

          // Corner radius must never exceed half dimension
          expect(rect.cornerRadius).toBeLessThanOrEqual(rect.width / 2 + 0.01);
          expect(rect.cornerRadius).toBeLessThanOrEqual(rect.height / 2 + 0.01);
        }
      }
    }
  });

  it("applies inner gaps accurately between adjacent tiled cells", () => {
    const grid2x2 = getTemplateById("grid-2x2");
    const gap = 16;
    const padding = 20;
    const width = 1000;
    const height = 1000;

    const rects = computeCellRects(grid2x2.cells, {
      collageWidth: width,
      collageHeight: height,
      padding,
      gap,
      cornerRadius: 8,
    });

    const c1 = rects.find((r) => r.id === "c1")!; // top-left
    const c2 = rects.find((r) => r.id === "c2")!; // top-right
    const c3 = rects.find((r) => r.id === "c3")!; // bottom-left

    // Gap between top-left right edge and top-right left edge
    const horizontalGap = c2.x - (c1.x + c1.width);
    expect(Math.round(horizontalGap)).toBe(gap);

    // Gap between top-left bottom edge and bottom-left top edge
    const verticalGap = c3.y - (c1.y + c1.height);
    expect(Math.round(verticalGap)).toBe(gap);
  });

  it("preserves polaroid card rotation and circle shape dimensions", () => {
    const polaroidTmpl = getTemplateById("polaroid-3");
    const rects = computeCellRects(polaroidTmpl.cells, {
      collageWidth: 800,
      collageHeight: 800,
      padding: 10,
      gap: 0,
      cornerRadius: 0,
    });

    expect(rects[0].shape).toBe("polaroid");
    expect(rects[0].rotation).toBe(-6);

    const circlesTmpl = getTemplateById("circles-5");
    const circleRects = computeCellRects(circlesTmpl.cells, {
      collageWidth: 1000,
      collageHeight: 1000,
      padding: 20,
      gap: 10,
      cornerRadius: 10,
    });

    // Circular cells should be square for perfect circle rounding
    for (const cr of circleRects) {
      expect(cr.shape).toBe("circle");
      expect(Math.abs(cr.width - cr.height)).toBeLessThanOrEqual(1);
      expect(cr.cornerRadius).toBeCloseTo(cr.width / 2, 0);
    }
  });

  it("calculates correct aspect ratio dimensions", () => {
    const aspects: CollageAspect[] = ["1:1", "4:5", "9:16", "16:9"];
    for (const asp of aspects) {
      const dim = calculateCollageDimensions(asp, 1000, 1000, 1200);
      expect(dim.width).toBeGreaterThan(0);
      expect(dim.height).toBeGreaterThan(0);

      if (asp === "1:1") {
        expect(dim.width).toBe(dim.height);
      } else if (asp === "16:9") {
        expect(dim.width).toBeGreaterThan(dim.height);
      } else if (asp === "9:16" || asp === "4:5") {
        expect(dim.height).toBeGreaterThan(dim.width);
      }
    }
  });
});
