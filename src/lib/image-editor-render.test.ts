import { describe, expect, it } from "vitest";
import {
  applyPixelFilter,
  applySpotHeal,
  applyWarmth,
  meanRedChannel,
} from "@/lib/image-editor-render";

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

  it("warmth shifts red channel up", () => {
    const img = imageDataFromRgba([100, 100, 100, 255]);
    const before = meanRedChannel(img);
    applyWarmth(img, 120);
    expect(meanRedChannel(img)).toBeGreaterThan(before);
  });

  it("spot heal visibly softens a dark blemish", () => {
    const w = 32;
    const h = 32;
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        data[i] = 240;
        data[i + 1] = 120;
        data[i + 2] = 40;
        data[i + 3] = 255;
      }
    }
    for (let y = 12; y < 18; y++) {
      for (let x = 12; x < 18; x++) {
        const i = (y * w + x) * 4;
        data[i] = 10;
        data[i + 1] = 10;
        data[i + 2] = 10;
      }
    }
    const imageData = { data, width: w, height: h, colorSpace: "srgb" } as ImageData;
    const center = (15 * w + 15) * 4;
    const before = imageData.data[center];
    applySpotHeal(imageData, 15 / (w - 1), 15 / (h - 1), 10);
    const after = imageData.data[center];
    expect(after - before).toBeGreaterThan(30);
  });

  it("mono collapses channels equally", () => {
    const img = imageDataFromRgba([40, 80, 200, 255]);
    applyPixelFilter(img, "mono");
    expect(img.data[0]).toBe(img.data[1]);
    expect(img.data[1]).toBe(img.data[2]);
  });
});
