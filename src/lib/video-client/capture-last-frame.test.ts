import { describe, expect, it } from "vitest";
import { captureTargetTimeSec, scaleCaptureDimensions } from "./capture-last-frame";

describe("capture-last-frame helpers", () => {
  it("picks a target timestamp shortly before EOF", () => {
    expect(captureTargetTimeSec(5)).toBeCloseTo(4.95);
    expect(captureTargetTimeSec(1)).toBeCloseTo(0.98);
    expect(captureTargetTimeSec(0.4)).toBeCloseTo(0.39);
    expect(captureTargetTimeSec(0)).toBe(0);
    expect(captureTargetTimeSec(Number.NaN)).toBe(0);
  });

  it("scales dimensions down while preserving aspect ratio", () => {
    expect(scaleCaptureDimensions(1280, 720)).toEqual({ width: 1280, height: 720 });
    expect(scaleCaptureDimensions(1920, 1080, 1280)).toEqual({ width: 1280, height: 720 });
    expect(scaleCaptureDimensions(0, 100)).toEqual({ width: 0, height: 0 });
  });
});
