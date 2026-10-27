import { describe, expect, it } from "vitest";
import { clampVideoDuration, getVideoLimits, isDurationValid } from "@/lib/ai/video-limits";

describe("video limits", () => {
  it("gif is 1-4 s and video is 5-13 s", () => {
    expect(getVideoLimits("gif")).toMatchObject({ minSec: 1, maxSec: 4 });
    expect(getVideoLimits("video")).toMatchObject({ minSec: 5, maxSec: 13 });
  });

  it("defaults to video limits", () => {
    expect(getVideoLimits()).toEqual(getVideoLimits("video"));
  });

  it("clamps into range and falls back to the default", () => {
    expect(clampVideoDuration("gif", 10)).toBe(4);
    expect(clampVideoDuration("gif", 0)).toBe(1);
    expect(clampVideoDuration("video", 2)).toBe(5);
    expect(clampVideoDuration("video", 99)).toBe(13);
    expect(clampVideoDuration("video", undefined)).toBe(8);
    expect(clampVideoDuration("gif", Number.NaN)).toBe(3);
  });

  it("validates ranges per mode", () => {
    expect(isDurationValid("gif", 4)).toBe(true);
    expect(isDurationValid("gif", 5)).toBe(false);
    expect(isDurationValid("video", 4)).toBe(false);
    expect(isDurationValid("video", 13)).toBe(true);
  });
});
