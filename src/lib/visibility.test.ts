import { describe, expect, it } from "vitest";
import { clampMatureVisibility, inheritMature, normalizeVisibility } from "@/lib/visibility";

describe("clampMatureVisibility", () => {
  it("demotes mature PUBLIC content to UNLISTED", () => {
    expect(clampMatureVisibility("PUBLIC", true)).toBe("UNLISTED");
  });
  it("leaves non-mature content alone", () => {
    expect(clampMatureVisibility("PUBLIC", false)).toBe("PUBLIC");
  });
  it("never widens visibility", () => {
    expect(clampMatureVisibility("PRIVATE", true)).toBe("PRIVATE");
    expect(clampMatureVisibility("UNLISTED", true)).toBe("UNLISTED");
  });
  it("composes with normalizeVisibility for legacy HIDDEN values", () => {
    expect(clampMatureVisibility(normalizeVisibility("HIDDEN"), true)).toBe("PRIVATE");
  });
});

describe("inheritMature", () => {
  it("inherits mature from the parent", () => {
    expect(inheritMature(undefined, true)).toBe(true);
  });
  it("keeps an explicit mature flag", () => {
    expect(inheritMature(true, false)).toBe(true);
    expect(inheritMature(true, undefined)).toBe(true);
  });
  it("is not mature when neither side is", () => {
    expect(inheritMature(undefined, undefined)).toBe(false);
    expect(inheritMature(false, false)).toBe(false);
  });
  it("cannot be cleared by omitting the flag on a derived version", () => {
    expect(inheritMature(false, true)).toBe(true);
  });
});
