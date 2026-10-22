import { describe, expect, it } from "vitest";
import { FUN_FILTERS, applyFunFilter, isFunFilter } from "@/lib/fun-filters";

function makeImage(width = 320, height = 240): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = (x * 255) / (width - 1);
      data[i + 1] = (y * 255) / (height - 1);
      data[i + 2] = ((x + y) * 255) / (width + height - 2);
      data[i + 3] = 200;
    }
  }
  return { data, width, height, colorSpace: "srgb" } as unknown as ImageData;
}

const clone = (img: ImageData) =>
  ({ ...img, data: new Uint8ClampedArray(img.data) }) as unknown as ImageData;

describe("fun filters", () => {
  it("registers unique ids", () => {
    const ids = FUN_FILTERS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => isFunFilter(id))).toBe(true);
    expect(isFunFilter("not-a-filter")).toBe(false);
  });

  it("returns false for unknown filters and leaves pixels alone", () => {
    const img = makeImage();
    const before = new Uint8ClampedArray(img.data);
    expect(applyFunFilter(img, "nope")).toBe(false);
    expect(Array.from(img.data)).toEqual(Array.from(before));
  });

  for (const filter of FUN_FILTERS) {
    describe(filter.id, () => {
      it("changes the picture and keeps alpha", () => {
        const img = makeImage();
        const before = new Uint8ClampedArray(img.data);
        expect(applyFunFilter(img, filter.id, { timeSec: 1.3 })).toBe(true);
        expect(Array.from(img.data)).not.toEqual(Array.from(before));
        for (let i = 3; i < img.data.length; i += 4) expect(img.data[i]).toBe(200);
      });

      it("is deterministic", () => {
        const a = makeImage();
        const b = clone(a);
        applyFunFilter(a, filter.id, { timeSec: 0.7 });
        applyFunFilter(b, filter.id, { timeSec: 0.7 });
        expect(Array.from(a.data)).toEqual(Array.from(b.data));
      });

      it("does nothing at zero intensity", () => {
        const img = makeImage();
        const before = new Uint8ClampedArray(img.data);
        applyFunFilter(img, filter.id, { timeSec: 1.3, intensity: 0 });
        expect(Array.from(img.data)).toEqual(Array.from(before));
      });

      it("blends partway at half intensity", () => {
        const full = makeImage();
        const half = clone(full);
        const original = new Uint8ClampedArray(full.data);
        applyFunFilter(full, filter.id, { timeSec: 1.3 });
        applyFunFilter(half, filter.id, { timeSec: 1.3, intensity: 0.5 });
        let checked = 0;
        for (let i = 0; i < original.length; i += 4) {
          const expected = original[i] + (full.data[i] - original[i]) * 0.5;
          expect(Math.abs(half.data[i] - expected)).toBeLessThanOrEqual(1);
          checked++;
        }
        expect(checked).toBeGreaterThan(0);
      });

      if (filter.animated) {
        it("animates over time", () => {
          const a = makeImage();
          const b = clone(a);
          applyFunFilter(a, filter.id, { timeSec: 0.4 });
          applyFunFilter(b, filter.id, { timeSec: 2.9 });
          expect(Array.from(a.data)).not.toEqual(Array.from(b.data));
        });
      }
    });
  }
});
