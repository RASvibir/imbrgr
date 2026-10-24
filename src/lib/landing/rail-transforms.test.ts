import { describe, it, expect } from "vitest";
import {
  calculateMemeLayout,
  calculateCollageSlices,
  buildToolUrl,
} from "./rail-transforms";

describe("Rail transform pure calculations", () => {
  it("calculates proportional meme text metrics", () => {
    const layout = calculateMemeLayout(600, 600, "TOP", "BOTTOM");
    expect(layout.topText).toBe("TOP");
    expect(layout.bottomText).toBe("BOTTOM");
    expect(layout.fontSize).toBe(54); // 600 * 0.09
    expect(layout.strokeWidth).toBeGreaterThan(2);
    expect(layout.topY).toBeGreaterThan(0);
    expect(layout.bottomY).toBeLessThan(600);
  });

  it("calculates clean non-overlapping collage slices", () => {
    const slices = calculateCollageSlices(400, 400, 4);
    expect(slices).toHaveLength(3);

    const [main, zoom, bottom] = slices;
    expect(main.dw + 4 + zoom.dw).toBe(400);
    expect(zoom.dh + 4 + bottom.dh).toBe(400);
  });

  it("builds tool navigation URLs with from=landing and handoff parameter", () => {
    expect(buildToolUrl("/tools/meme", "abc-123")).toBe(
      "/tools/meme?from=landing&handoff=abc-123",
    );
    expect(buildToolUrl("/studio?tab=video", "xyz-789")).toBe(
      "/studio?tab=video&from=landing&handoff=xyz-789",
    );
    expect(buildToolUrl("/tools/ar", null)).toBe("/tools/ar?from=landing");
  });
});
