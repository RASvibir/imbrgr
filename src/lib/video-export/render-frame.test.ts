import { describe, expect, it } from "vitest";
import { coverRect } from "./render-frame";

describe("coverRect", () => {
  it("crops the sides of a wide source into a tall target", () => {
    const r = coverRect(1600, 900, 720, 1280);
    expect(r).not.toBeNull();
    expect(r!.sh).toBe(900);
    expect(r!.sw).toBeCloseTo(900 * (720 / 1280));
    expect(r!.sx).toBeCloseTo((1600 - r!.sw) / 2);
    expect(r!.sy).toBe(0);
  });

  it("crops top and bottom of a tall source into a wide target", () => {
    const r = coverRect(900, 1600, 1280, 720)!;
    expect(r.sw).toBe(900);
    expect(r.sh).toBeCloseTo(900 * (720 / 1280));
    expect(r.sx).toBe(0);
  });

  it("returns the full frame when aspect ratios match", () => {
    expect(coverRect(1280, 720, 640, 360)).toEqual({ sx: 0, sy: 0, sw: 1280, sh: 720 });
  });

  it("rejects empty sources and targets", () => {
    expect(coverRect(0, 100, 10, 10)).toBeNull();
    expect(coverRect(100, 100, 0, 10)).toBeNull();
  });
});
