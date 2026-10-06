import { describe, expect, it } from "vitest";
import { normalizeStudioAsset } from "./studio-asset";

describe("normalizeStudioAsset", () => {
  it("accepts mediaShortId from generate API", () => {
    const a = normalizeStudioAsset({
      mediaShortId: "abc12345",
      storageKey: "uuid.jpg",
      mimeType: "image/png",
    });
    expect(a.shortId).toBe("abc12345");
    expect(a.storageKey).toBe("uuid.jpg");
  });
});
