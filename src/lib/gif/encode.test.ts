import { describe, it, expect } from "vitest";
import {
  calculateFrameDelay,
  normalizeGifRepeat,
  calculateEstimatedGifSize,
  buildBoomerangFrames,
  reverseFrames,
  sampleVideoTimes,
  applyFloydSteinbergDither,
  encodeGifFrames,
  type GifFrameInput,
} from "./encode";

describe("GIF timing & repeat math", () => {
  it("calculates frame delay in ms from fps and speed", () => {
    // 10 FPS at 1x speed => 100ms
    expect(calculateFrameDelay(10, 1)).toBe(100);

    // 20 FPS at 1x speed => 50ms
    expect(calculateFrameDelay(20, 1)).toBe(50);

    // 10 FPS at 2x speed => 50ms
    expect(calculateFrameDelay(10, 2)).toBe(50);

    // 10 FPS at 0.5x speed => 200ms
    expect(calculateFrameDelay(10, 0.5)).toBe(200);

    // Clamps to minimum 20ms for browser compatibility
    expect(calculateFrameDelay(60, 4)).toBe(20);
  });

  it("maps user loop count to GIF Netscape extension repeat value", () => {
    // 0 = infinite loop
    expect(normalizeGifRepeat(0)).toBe(0);
    expect(normalizeGifRepeat(-1)).toBe(0);

    // 1 = play once (repeat: -1)
    expect(normalizeGifRepeat(1)).toBe(-1);

    // N = repeat N times
    expect(normalizeGifRepeat(2)).toBe(1);
    expect(normalizeGifRepeat(5)).toBe(4);
  });

  it("estimates GIF byte size reasonably", () => {
    expect(calculateEstimatedGifSize(0, 0, 0)).toBe(0);

    const sizeSmall = calculateEstimatedGifSize(320, 240, 10, 256, false);
    const sizeLarge = calculateEstimatedGifSize(640, 480, 10, 256, false);
    expect(sizeLarge).toBeGreaterThan(sizeSmall);

    // Dithered GIFs are larger than non-dithered
    const sizeDithered = calculateEstimatedGifSize(320, 240, 10, 256, true);
    expect(sizeDithered).toBeGreaterThan(sizeSmall);

    // Smaller palette reduces estimated size
    const sizeLowColor = calculateEstimatedGifSize(320, 240, 10, 32, false);
    expect(sizeLowColor).toBeLessThan(sizeSmall);
  });
});

describe("Frame sequence operations", () => {
  it("builds boomerang frames without duplicating endpoints", () => {
    expect(buildBoomerangFrames([1])).toEqual([1]);
    expect(buildBoomerangFrames([1, 2])).toEqual([1, 2]);

    const frames = ["A", "B", "C", "D"];
    const boomerang = buildBoomerangFrames(frames);
    // [A, B, C, D] -> [A, B, C, D, C, B]
    expect(boomerang).toEqual(["A", "B", "C", "D", "C", "B"]);
  });

  it("reverses frames accurately", () => {
    const frames = [1, 2, 3, 4];
    expect(reverseFrames(frames)).toEqual([4, 3, 2, 1]);
  });

  it("samples video timestamps evenly", () => {
    expect(sampleVideoTimes(0, 10)).toEqual([]);

    // 1 second at 2 FPS => [0, 0.5, 1]
    const times = sampleVideoTimes(1.0, 2, 0, 1.0);
    expect(times).toEqual([0, 0.5, 1]);

    // Sub-range trim: 1s to 2s at 2 FPS
    const trimmedTimes = sampleVideoTimes(5.0, 2, 1.0, 2.0);
    expect(trimmedTimes).toEqual([1, 1.5, 2]);
  });
});

describe("Floyd-Steinberg dithering", () => {
  it("maps pixel colors to palette indices with error diffusion", () => {
    const width = 4;
    const height = 4;
    const rgba = new Uint8Array(width * height * 4);

    // Fill with a horizontal gradient of gray
    for (let i = 0; i < width * height; i++) {
      const val = (i % width) * 60;
      rgba[i * 4] = val;
      rgba[i * 4 + 1] = val;
      rgba[i * 4 + 2] = val;
      rgba[i * 4 + 3] = 255;
    }

    // Black & White palette
    const palette = [
      [0, 0, 0],
      [255, 255, 255],
    ];

    const indices = applyFloydSteinbergDither(rgba, width, height, palette);
    expect(indices.length).toBe(width * height);

    // Each index must be 0 or 1
    for (let i = 0; i < indices.length; i++) {
      expect(indices[i] === 0 || indices[i] === 1).toBe(true);
    }
  });
});

describe("GIF Encoding", () => {
  const createTestFrame = (w: number, h: number, r: number, g: number, b: number): GifFrameInput => {
    const data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      data[i * 4] = r;
      data[i * 4 + 1] = g;
      data[i * 4 + 2] = b;
      data[i * 4 + 3] = 255;
    }
    return { width: w, height: h, data, delay: 50 };
  };

  it("encodes multiple frames into a valid GIF blob", async () => {
    const f1 = createTestFrame(8, 8, 255, 0, 0);
    const f2 = createTestFrame(8, 8, 0, 255, 0);
    const f3 = createTestFrame(8, 8, 0, 0, 255);

    const blob = await encodeGifFrames([f1, f2, f3], {
      paletteSize: 32,
      dither: false,
      loopCount: 0,
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe("image/gif");
    expect(blob.size).toBeGreaterThan(0);

    const buffer = await blob.arrayBuffer();
    const header = new TextDecoder().decode(buffer.slice(0, 6));
    expect(header).toBe("GIF89a");
  });

  it("handles dithering and custom loop counts", async () => {
    const f1 = createTestFrame(4, 4, 120, 80, 40);
    const f2 = createTestFrame(4, 4, 200, 150, 50);

    const blob = await encodeGifFrames([f1, f2], {
      paletteSize: 16,
      dither: "floyd-steinberg",
      loopCount: 1, // play once
    });

    expect(blob.type).toBe("image/gif");
    expect(blob.size).toBeGreaterThan(0);
  });

  it("supports cancellation via AbortSignal", async () => {
    const f1 = createTestFrame(4, 4, 10, 10, 10);
    const f2 = createTestFrame(4, 4, 20, 20, 20);

    const controller = new AbortController();
    controller.abort();

    await expect(
      encodeGifFrames([f1, f2], {
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });
});
