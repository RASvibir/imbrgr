import { describe, expect, it } from "vitest";
import { cheeseMeltPercent, spiceDeltaForView, spiceLevel } from "@/lib/cheese-spice";

describe("cheese-spice", () => {
  it("spice level steps with score", () => {
    expect(spiceLevel(0)).toBe(0);
    expect(spiceLevel(1)).toBe(1);
    expect(spiceLevel(7)).toBe(2);
    expect(spiceLevel(50)).toBe(5);
  });

  it("melt percent grows with heat", () => {
    expect(cheeseMeltPercent(0)).toBe(0);
    expect(cheeseMeltPercent(10)).toBeGreaterThan(cheeseMeltPercent(2));
  });

  it("spice delta: signed-in first view is zero", () => {
    expect(spiceDeltaForView(false, false)).toBe(0);
  });

  it("spice delta: anonymous first view and repeats add heat", () => {
    expect(spiceDeltaForView(true, false)).toBe(1);
    expect(spiceDeltaForView(false, true)).toBe(1);
    expect(spiceDeltaForView(true, true)).toBe(1);
  });
});
