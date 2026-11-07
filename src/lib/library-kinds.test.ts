import { describe, expect, it } from "vitest";
import { normalizeLibraryAssetKind, parseLibraryAssetKind } from "@/lib/library-kinds";

describe("library-kinds", () => {
  it("parses kind query values", () => {
    expect(parseLibraryAssetKind("character")).toBe("CHARACTER");
    expect(parseLibraryAssetKind("PROP")).toBe("PROP");
    expect(parseLibraryAssetKind("logo")).toBe("LOGO");
    expect(parseLibraryAssetKind("weird")).toBeNull();
  });

  it("normalizes with fallback", () => {
    expect(normalizeLibraryAssetKind(undefined)).toBe("GENERAL");
    expect(normalizeLibraryAssetKind("background")).toBe("BACKGROUND");
    expect(normalizeLibraryAssetKind("LOGO")).toBe("LOGO");
  });
});
