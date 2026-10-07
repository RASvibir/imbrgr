import { describe, expect, it } from "vitest";
import { resolveFieldPressComposeHref } from "@/lib/fieldpress-compose";

describe("resolveFieldPressComposeHref", () => {
  const direct = "https://imbrgr.vercel.app/api/media/file/uploads/x.png?mime=image%2Fpng";

  it("returns compose url for public media", () => {
    const href = resolveFieldPressComposeHref({ imageDirectUrl: direct, visibility: "PUBLIC" });
    expect(href).toContain("fieldpress.studio");
    expect(href).toContain("compose=1");
  });

  it("hides for private visibility", () => {
    expect(resolveFieldPressComposeHref({ imageDirectUrl: direct, visibility: "PRIVATE" })).toBeNull();
  });

  it("prefers draft handoff when draft id is set", () => {
    const href = resolveFieldPressComposeHref({
      imageDirectUrl: direct,
      visibility: "UNLISTED",
      draftId: "draft-1",
    });
    expect(href).toContain("draft=draft-1");
  });
});
