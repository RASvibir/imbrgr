import { describe, expect, it } from "vitest";
import { resolveAiGalleryVisibility, resolveAiGenerationVisibility, clampMatureVisibility, titleFromAiPrompt } from "@/lib/ai/gallery-post";

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



  it("forces mature AI output off public gallery", () => {
    expect(
      resolveAiGenerationVisibility({
        requested: "PUBLIC",
        userId: "user-1",
        matureRequested: true,
      }),
    ).toBe("UNLISTED");
    expect(
      resolveAiGenerationVisibility({
        requested: "PRIVATE",
        userId: "user-1",
        matureRequested: true,
      }),
    ).toBe("PRIVATE");
  });

  it("clamps mature content away from PUBLIC on later edits", () => {
    expect(clampMatureVisibility("PUBLIC", true)).toBe("UNLISTED");
    expect(clampMatureVisibility("PUBLIC", false)).toBe("PUBLIC");
    expect(clampMatureVisibility("PRIVATE", true)).toBe("PRIVATE");
    expect(clampMatureVisibility("UNLISTED", true)).toBe("UNLISTED");
  });

  it("builds a post title from the prompt", () => {
    expect(titleFromAiPrompt("  ember burger test  ")).toBe("ember burger test");
  });
});
