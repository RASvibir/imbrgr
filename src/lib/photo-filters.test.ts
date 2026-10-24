import { describe, expect, it } from "vitest";
import {
  PHOTO_FILTERS,
  applyPhotoFilter,
  isPhotoFilter,
  getPhotoFilter,
  makeToneCurve,
  hash2,
  applyVignetteImageData,
  applyFilmGrain,
  applyBloomGlow,
  applyFastBlur,
  applyDuotone,
} from "@/lib/photo-filters";

function makeTestImage(width = 120, height = 90): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = Math.round((x * 255) / (width - 1));
      data[i + 1] = Math.round((y * 255) / (height - 1));
      data[i + 2] = Math.round(((x + y) * 255) / (width + height - 2));
      data[i + 3] = 255;
    }
  }
  return { data, width, height, colorSpace: "srgb" } as unknown as ImageData;
}

const cloneImage = (img: ImageData): ImageData =>
  ({ ...img, data: new Uint8ClampedArray(img.data) }) as unknown as ImageData;

describe("photo-filters library", () => {
  it("has at least 24 original presets with valid metadata", () => {
    expect(PHOTO_FILTERS.length).toBeGreaterThanOrEqual(24);
    const ids = PHOTO_FILTERS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const f of PHOTO_FILTERS) {
      expect(f.id.length).toBeGreaterThan(0);
      expect(f.label.length).toBeGreaterThan(0);
      expect(f.description.length).toBeGreaterThan(0);
      expect(f.emoji.length).toBeGreaterThan(0);
      expect(["cinematic", "vintage", "monochrome", "artistic", "mood", "duotone"]).toContain(
        f.category,
      );
      expect(typeof f.animated).toBe("boolean");
      expect(typeof f.apply).toBe("function");
      expect(isPhotoFilter(f.id)).toBe(true);
      expect(getPhotoFilter(f.id)).toBe(f);
    }
  });

  it("returns false for unknown filter id and preserves image", () => {
    const img = makeTestImage();
    const before = new Uint8ClampedArray(img.data);
    expect(applyPhotoFilter(img, "non-existent-filter")).toBe(false);
    expect(Array.from(img.data)).toEqual(Array.from(before));
  });

  it("handles intensity 0 as no-op", () => {
    const img = makeTestImage();
    const before = new Uint8ClampedArray(img.data);
    expect(applyPhotoFilter(img, "cinematic-teal-orange", { intensity: 0 })).toBe(true);
    expect(Array.from(img.data)).toEqual(Array.from(before));
  });

  it("blends linearly with 50% intensity", () => {
    const imgFull = makeTestImage();
    const imgHalf = makeTestImage();
    const original = cloneImage(imgFull);

    applyPhotoFilter(imgFull, "duotone-sunset", { intensity: 1.0 });
    applyPhotoFilter(imgHalf, "duotone-sunset", { intensity: 0.5 });

    // Midpoint check on non-alpha channels
    for (let i = 0; i < 40; i++) {
      if (i % 4 === 3) continue;
      const expected = Math.round(original.data[i] + (imgFull.data[i] - original.data[i]) * 0.5);
      expect(Math.abs(imgHalf.data[i] - expected)).toBeLessThanOrEqual(1);
    }
  });

  it("preserves alpha channel completely across all presets", () => {
    for (const filter of PHOTO_FILTERS) {
      const img = makeTestImage(40, 30);
      // Give arbitrary alpha
      for (let i = 3; i < img.data.length; i += 4) {
        img.data[i] = 210;
      }
      applyPhotoFilter(img, filter.id, { timeSec: 1.2, intensity: 0.85 });
      for (let i = 3; i < img.data.length; i += 4) {
        expect(img.data[i]).toBe(210);
      }
    }
  });

  it("is completely deterministic given the same inputs", () => {
    for (const filter of PHOTO_FILTERS) {
      const a = makeTestImage(40, 30);
      const b = cloneImage(a);
      applyPhotoFilter(a, filter.id, { timeSec: 0.42, intensity: 1 });
      applyPhotoFilter(b, filter.id, { timeSec: 0.42, intensity: 1 });
      expect(Array.from(a.data)).toEqual(Array.from(b.data));
    }
  });

  describe("pure primitive operations", () => {
    it("hash2 returns values in [0, 1) deterministically", () => {
      const v1 = hash2(12, 34, 56);
      const v2 = hash2(12, 34, 56);
      const v3 = hash2(12, 34, 57);
      expect(v1).toBe(v2);
      expect(v1).toBeGreaterThanOrEqual(0);
      expect(v1).toBeLessThan(1);
      expect(v1).not.toBe(v3);
    });

    it("makeToneCurve builds valid 256-byte monotonic/clamped curves", () => {
      const curve = makeToneCurve(1.2, 0.2, 10, 240);
      expect(curve.length).toBe(256);
      expect(curve[0]).toBeGreaterThanOrEqual(10);
      expect(curve[255]).toBeLessThanOrEqual(240);
      for (let i = 0; i < 256; i++) {
        expect(curve[i]).toBeGreaterThanOrEqual(0);
        expect(curve[i]).toBeLessThanOrEqual(255);
      }
    });

    it("applyVignetteImageData darkens corners more than the center", () => {
      const img = makeTestImage(100, 100);
      // Fill with flat white
      img.data.fill(200);
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;

      applyVignetteImageData(img, 0.2, 0.9, 0.8);

      const centerIdx = (50 * 100 + 50) * 4;
      const cornerIdx = 0; // (0, 0)
      expect(img.data[centerIdx]).toBe(200); // untouched in inner circle
      expect(img.data[cornerIdx]).toBeLessThan(200); // darkened in corner
    });

    it("applyFilmGrain generates noise without NaN or corrupting bounds", () => {
      const img = makeTestImage(50, 50);
      img.data.fill(128);
      for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;

      applyFilmGrain(img, 30, 0, 123);
      for (let i = 0; i < img.data.length; i++) {
        expect(Number.isNaN(img.data[i])).toBe(false);
        expect(img.data[i]).toBeGreaterThanOrEqual(0);
        expect(img.data[i]).toBeLessThanOrEqual(255);
      }
    });

    it("applyFastBlur smooths out high frequency noise", () => {
      const img = makeTestImage(40, 40);
      // Alternate black and white stripes
      for (let y = 0; y < 40; y++) {
        for (let x = 0; x < 40; x++) {
          const idx = (y * 40 + x) * 4;
          const val = x % 2 === 0 ? 0 : 255;
          img.data[idx] = val;
          img.data[idx + 1] = val;
          img.data[idx + 2] = val;
          img.data[idx + 3] = 255;
        }
      }
      applyFastBlur(img, 3);
      // Middle pixels should be averaged near 127
      const mid = (20 * 40 + 20) * 4;
      expect(Math.abs(img.data[mid] - 127)).toBeLessThan(20);
    });

    it("applyDuotone correctly maps black to dark color and white to light color", () => {
      const img = makeTestImage(2, 1);
      // Pixel 0 is black, Pixel 1 is white
      img.data[0] = 0;
      img.data[1] = 0;
      img.data[2] = 0;
      img.data[3] = 255;
      img.data[4] = 255;
      img.data[5] = 255;
      img.data[6] = 255;
      img.data[7] = 255;

      applyDuotone(img, [10, 20, 30], [210, 220, 230]);
      expect(img.data[0]).toBe(10);
      expect(img.data[1]).toBe(20);
      expect(img.data[2]).toBe(30);
      expect(img.data[4]).toBe(210);
      expect(img.data[5]).toBe(220);
      expect(img.data[6]).toBe(230);
    });
  });
});
