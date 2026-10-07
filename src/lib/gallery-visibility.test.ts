import { describe, expect, it } from "vitest";
import { resolveGalleryPostVisibility } from "@/lib/gallery-visibility";

describe("resolveGalleryPostVisibility", () => {
  it("forces public for guests", () => {
    expect(resolveGalleryPostVisibility(undefined, null)).toBe("PUBLIC");
    expect(resolveGalleryPostVisibility("PRIVATE", null)).toBe("PUBLIC");
    expect(resolveGalleryPostVisibility("UNLISTED", null)).toBe("PUBLIC");
  });

  it("defaults signed-in users to public", () => {
    expect(resolveGalleryPostVisibility(undefined, "user-1")).toBe("PUBLIC");
    expect(resolveGalleryPostVisibility(undefined, "user-1", "UNLISTED")).toBe("UNLISTED");
  });

  it("honors explicit signed-in choices", () => {
    expect(resolveGalleryPostVisibility("PRIVATE", "user-1")).toBe("PRIVATE");
    expect(resolveGalleryPostVisibility("UNLISTED", "user-1", "PUBLIC")).toBe("UNLISTED");
  });
});
