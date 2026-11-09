import { describe, expect, it } from "vitest";
import { isStudioEmbedParam, studioEmbedCspFrameAncestors } from "@/lib/studio-embed";

describe("studio embed", () => {
  it("parses embed flags", () => {
    expect(isStudioEmbedParam("1")).toBe(true);
    expect(isStudioEmbedParam("true")).toBe(true);
    expect(isStudioEmbedParam("0")).toBe(false);
    expect(isStudioEmbedParam(null)).toBe(false);
  });

  it("includes FieldPress in frame-ancestors CSP", () => {
    const csp = studioEmbedCspFrameAncestors();
    expect(csp).toContain("frame-ancestors");
    expect(csp).toContain("https://fieldpress.studio");
  });
});
