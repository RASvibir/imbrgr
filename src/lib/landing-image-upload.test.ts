import { describe, expect, it } from "vitest";
import { validateLandingImageFile } from "@/lib/landing-image-upload";
import { MAX_IMAGE_BYTES } from "@/lib/validation";

describe("validateLandingImageFile", () => {
  it("accepts png", () => {
    const f = new File([new Uint8Array(8)], "a.png", { type: "image/png" });
    expect(validateLandingImageFile(f)).toBeNull();
  });

  it("accepts png when mime is missing but extension is png", () => {
    const f = new File([new Uint8Array(8)], "a.png", { type: "" });
    expect(validateLandingImageFile(f)).toBeNull();
  });

  it("rejects non-image", () => {
    const f = new File([new Uint8Array(8)], "a.txt", { type: "text/plain" });
    expect(validateLandingImageFile(f)).toMatch(/isn't an image/i);
  });

  it("rejects oversized", () => {
    const f = new File([new Uint8Array(1)], "big.png", { type: "image/png" });
    Object.defineProperty(f, "size", { value: MAX_IMAGE_BYTES + 1 });
    expect(validateLandingImageFile(f)).toMatch(/too big/i);
  });
});
