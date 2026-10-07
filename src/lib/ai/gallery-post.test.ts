import { describe, expect, it } from "vitest";
import { resolveAiGalleryVisibility, titleFromAiPrompt } from "@/lib/ai/gallery-post";

describe("gallery post helpers", () => {
  it("defaults to public gallery visibility", () => {
    expect(resolveAiGalleryVisibility(undefined, null)).toBe("PUBLIC");
    expect(resolveAiGalleryVisibility(undefined, "user-1")).toBe("PUBLIC");
  });

  it("honors explicit unlisted or private", () => {
    expect(resolveAiGalleryVisibility("UNLISTED", "user-1")).toBe("UNLISTED");
    expect(resolveAiGalleryVisibility("PRIVATE", "user-1")).toBe("PRIVATE");
    expect(resolveAiGalleryVisibility("PRIVATE", null)).toBe("PUBLIC");
    expect(resolveAiGalleryVisibility("UNLISTED", null)).toBe("PUBLIC");
  });

  it("builds a post title from the prompt", () => {
    expect(titleFromAiPrompt("  ember burger test  ")).toBe("ember burger test");
  });
});
