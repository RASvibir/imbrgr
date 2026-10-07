import { describe, expect, it } from "vitest";
import { isStorageKeySegment } from "./media-keys";
import { mediaFilePath, mediaUrl, profileImageUrlBusted } from "./urls";

describe("media URLs", () => {
  it("serves bytes under /api/media/file/ not /api/media/", () => {
    const key = "36add3f9-0b64-4650-bd8c-69094cc7772d.jpg";
    expect(mediaFilePath(key)).toBe(`/api/media/file/${key}`);
    expect(mediaUrl(key, "image/jpeg")).toBe(
      `/api/media/file/${key}?mime=${encodeURIComponent("image/jpeg")}`,
    );
  });

  it("appends cache bust on profile images", () => {
    const key = "user/avatar.jpg";
    expect(profileImageUrlBusted(key, 123)).toContain("v=123");
    expect(profileImageUrlBusted(key, null)).not.toContain("v=");
  });

  it("distinguishes shortId from storageKey", () => {
    expect(isStorageKeySegment("n4xjhpqx")).toBe(false);
    expect(isStorageKeySegment("36add3f9-0b64-4650-bd8c-69094cc7772d.jpg")).toBe(true);
  });
});
