import { describe, expect, it } from "vitest";
import {
  formatTimecode,
  splitClipAtTime,
  trimClip,
  calculateTimelineDuration,
  findActiveVisualClips,
  computeMotionTransform,
} from "@/lib/video-timeline/timeline-ops";
import type { VisualClip } from "@/lib/video-timeline/timeline-types";

describe("Timeline Operations", () => {
  const sampleClip: VisualClip = {
    id: "clip-1",
    trackId: "track-v1",
    assetId: "asset-1",
    url: "https://example.com/video.mp4",
    name: "Burger sizzle",
    kind: "video",
    startSec: 1.0,
    endSec: 5.0,
    sourceStartSec: 0,
    sourceDurationSec: 10,
  };

  it("formats timecode accurately", () => {
    expect(formatTimecode(0)).toBe("00:00.00");
    expect(formatTimecode(65.5)).toBe("01:05.50");
    expect(formatTimecode(12.34)).toBe("00:12.34");
  });

  it("splits a clip cleanly at playhead time", () => {
    const split = splitClipAtTime(sampleClip, 3.0);
    expect(split).not.toBeNull();
    if (!split) return;

    const [left, right] = split;
    expect(left.startSec).toBe(1.0);
    expect(left.endSec).toBe(3.0);
    expect(right.startSec).toBe(3.0);
    expect(right.endSec).toBe(5.0);
    expect(right.sourceStartSec).toBe(2.0);
  });

  it("rejects splitting outside clip bounds", () => {
    expect(splitClipAtTime(sampleClip, 0.5)).toBeNull();
    expect(splitClipAtTime(sampleClip, 5.5)).toBeNull();
    expect(splitClipAtTime(sampleClip, 1.01)).toBeNull();
  });

  it("trims clip safely", () => {
    const trimmed = trimClip(sampleClip, 2.0, 4.0);
    expect(trimmed.startSec).toBe(2.0);
    expect(trimmed.endSec).toBe(4.0);
  });

  it("calculates total duration across clips", () => {
    const duration = calculateTimelineDuration([
      sampleClip,
      { ...sampleClip, id: "clip-2", startSec: 4.5, endSec: 8.2 },
    ]);
    expect(duration).toBe(8.2);
  });

  it("finds active visual clips at given time", () => {
    const clips = [
      sampleClip,
      { ...sampleClip, id: "clip-2", startSec: 5.0, endSec: 9.0 },
    ];
    const activeAt2 = findActiveVisualClips(clips, 2.5);
    expect(activeAt2.length).toBe(1);
    expect(activeAt2[0].id).toBe("clip-1");

    const activeAt6 = findActiveVisualClips(clips, 6.0);
    expect(activeAt6.length).toBe(1);
    expect(activeAt6[0].id).toBe("clip-2");
  });

  it("computes smooth camera motion transforms", () => {
    const zoomInStart = computeMotionTransform("zoom-in", 0);
    const zoomInEnd = computeMotionTransform("zoom-in", 1);
    expect(zoomInStart.scale).toBe(1.0);
    expect(zoomInEnd.scale).toBeCloseTo(1.35);

    const orbit = computeMotionTransform("orbit", 0.5);
    expect(orbit.scale).toBeGreaterThan(1.0);
  });

  it("eases camera moves: slow at the ends, faster in the middle", () => {
    const early = computeMotionTransform("zoom-in", 0.1).scale - 1;
    const mid = computeMotionTransform("zoom-in", 0.55).scale - computeMotionTransform("zoom-in", 0.45).scale;
    expect(early).toBeLessThan(0.02);
    expect(mid / 0.1).toBeGreaterThan(early / 0.1);
  });

  it("never reveals the image edges for any move at any moment", () => {
    const motions = ["zoom-in", "zoom-out", "pan-right", "pan-left", "orbit", "pulse", "dramatic"] as const;
    for (const m of motions) {
      for (let i = 0; i <= 100; i++) {
        const t = computeMotionTransform(m, i / 100);
        const room = ((t.scale - 1) / 2) * 100;
        expect(t.scale).toBeGreaterThanOrEqual(1);
        expect(Math.abs(t.translateXPercent)).toBeLessThanOrEqual(room + 1e-9);
        expect(Math.abs(t.translateYPercent)).toBeLessThanOrEqual(room + 1e-9);
        // 2.5 degrees of rotation on a 16:9 frame needs roughly 1.08x to stay covered.
        if (t.rotateDeg !== 0) expect(t.scale).toBeGreaterThanOrEqual(1.12);
      }
    }
  });

  it("pans in opposite directions and returns to rest at the ends of zoom-out", () => {
    expect(computeMotionTransform("pan-right", 0).translateXPercent).toBeGreaterThan(0);
    expect(computeMotionTransform("pan-right", 1).translateXPercent).toBeLessThan(0);
    expect(computeMotionTransform("pan-left", 0).translateXPercent).toBeLessThan(0);
    expect(computeMotionTransform("zoom-out", 1).scale).toBeCloseTo(1.0);
  });
});
