import { describe, expect, it } from "vitest";
import { applyPixelFilter, meanRedChannel } from "@/lib/image-editor-render";

function imageDataFromRgba(pixels: number[]): ImageData {
  return {
    data: new Uint8ClampedArray(pixels),
    width: 1,
    height: pixels.length / 4,
    colorSpace: "srgb",
  } as ImageData;
}

describe("applyPixelFilter", () => {
  it("ember filter shifts pixels toward warmer reds", () => {
    const img = imageDataFromRgba([100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255, 100, 100, 100, 255]);
    const before = meanRedChannel(img);
    applyPixelFilter(img, "ember");
    expect(meanRedChannel(img)).toBeGreaterThan(before);
  });

  it("mono collapses channels equally", () => {
    const img = imageDataFromRgba([40, 80, 200, 255]);
    applyPixelFilter(img, "mono");
    expect(img.data[0]).toBe(img.data[1]);
    expect(img.data[1]).toBe(img.data[2]);
  });
});
