import { describe, expect, it } from "vitest";
import { validateLandingImageFile, validateLandingMediaFile } from "@/lib/landing-image-upload";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES } from "@/lib/validation";

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

describe("validateLandingMediaFile", () => {
  it("accepts video files in video mode", () => {
    const f = new File([new Uint8Array(16)], "clip.mp4", { type: "video/mp4" });
    expect(validateLandingMediaFile(f, "video")).toBeNull();
  });

  it("accepts webm videos in video mode", () => {
    const f = new File([new Uint8Array(16)], "clip.webm", { type: "video/webm" });
    expect(validateLandingMediaFile(f, "video")).toBeNull();
  });

  it("accepts images in video mode for motion animation", () => {
    const f = new File([new Uint8Array(16)], "photo.jpg", { type: "image/jpeg" });
    expect(validateLandingMediaFile(f, "video")).toBeNull();
  });

  it("rejects non-media files in video mode", () => {
    const f = new File([new Uint8Array(16)], "doc.pdf", { type: "application/pdf" });
    expect(validateLandingMediaFile(f, "video")).toMatch(/isn't a format/i);
  });

  it("rejects oversized video in video mode", () => {
    const f = new File([new Uint8Array(1)], "huge.mp4", { type: "video/mp4" });
    Object.defineProperty(f, "size", { value: MAX_VIDEO_BYTES + 1 });
    expect(validateLandingMediaFile(f, "video")).toMatch(/too big/i);
  });
});
