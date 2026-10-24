import { describe, expect, it } from "vitest";
import {
  applyFilterStack,
  createFilterLayer,
  MAX_FILTER_STACK,
  estimateExportSize,
  type FilterStackLayer,
} from "./filters-engine";

function makeTestImage(width = 40, height = 30): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 120;
    data[i + 1] = 100;
    data[i + 2] = 80;
    data[i + 3] = 255;
  }
  return { data, width, height, colorSpace: "srgb" } as unknown as ImageData;
}

describe("filters-engine", () => {
  it("creates valid filter stack layer", () => {
    const layer = createFilterLayer("cinematic-teal-orange", 0.75);
    expect(layer.filterId).toBe("cinematic-teal-orange");
    expect(layer.intensity).toBe(0.75);
    expect(layer.enabled).toBe(true);
    expect(layer.id.length).toBeGreaterThan(0);
  });

  it("applies an empty stack as a no-op", () => {
    const img = makeTestImage();
    const orig = new Uint8ClampedArray(img.data);
    applyFilterStack(img, []);
    expect(Array.from(img.data)).toEqual(Array.from(orig));
  });

  it("applies stacked filters sequentially and preserves alpha", () => {
    const img = makeTestImage();
    const orig = new Uint8ClampedArray(img.data);

    const stack: FilterStackLayer[] = [
      createFilterLayer("cinematic-teal-orange", 0.8),
      createFilterLayer("film-grain", 0.5),
      createFilterLayer("vignette", 0.6),
    ];

    expect(stack.length).toBeLessThanOrEqual(MAX_FILTER_STACK);
    applyFilterStack(img, stack, 0);

    expect(Array.from(img.data)).not.toEqual(Array.from(orig));
    for (let i = 3; i < img.data.length; i += 4) {
      expect(img.data[i]).toBe(255);
    }
  });

  it("skips disabled layers and layers with 0 intensity", () => {
    const img1 = makeTestImage();
    const img2 = makeTestImage();

    const layer1 = createFilterLayer("noir", 1.0);
    const layer2 = createFilterLayer("duotone-sunset", 0);
    const layer3 = createFilterLayer("sepia", 1.0);
    layer3.enabled = false;

    applyFilterStack(img1, [layer1, layer2, layer3]);
    applyFilterStack(img2, [layer1]);

    expect(Array.from(img1.data)).toEqual(Array.from(img2.data));
  });

  it("estimates export sizes realistically", () => {
    const pngSize = estimateExportSize(1000, 1000, "png");
    const jpegSize = estimateExportSize(1000, 1000, "jpeg", 90);
    const webpSize = estimateExportSize(1000, 1000, "webp", 90);

    expect(pngSize).toBeGreaterThan(jpegSize);
    expect(webpSize).toBeLessThan(pngSize);
    expect(jpegSize).toBeGreaterThan(0);
  });
});
