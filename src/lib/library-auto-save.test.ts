import { describe, expect, it } from "vitest";
import { parseStudioKeepOriginal } from "@/lib/library-auto-save";

describe("parseStudioKeepOriginal", () => {
  it("defaults to true", () => {
    expect(parseStudioKeepOriginal(undefined)).toBe(true);
    expect(parseStudioKeepOriginal("true")).toBe(true);
  });
  it("parses false", () => {
    expect(parseStudioKeepOriginal(false)).toBe(false);
    expect(parseStudioKeepOriginal("false")).toBe(false);
    expect(parseStudioKeepOriginal("0")).toBe(false);
  });
});
