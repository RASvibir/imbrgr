import { describe, expect, it } from "vitest";
import { buildShareCodes } from "./embed-codes";

describe("buildShareCodes", () => {
  it("builds markdown and html", () => {
    const codes = buildShareCodes("abc123", "uploads/x.png", "image/png", "Test");
    expect(codes.markdown).toContain("![Test]");
    expect(codes.html).toContain("<img");
    expect(codes.bbcode).toContain("[img]");
    expect(codes.pageUrl).toContain("/i/abc123");
  });
});
