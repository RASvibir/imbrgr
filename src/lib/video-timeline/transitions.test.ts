import { describe, expect, it } from "vitest";
import {
  effectiveTransitionSec,
  previousAdjacentClip,
  transitionState,
} from "@/lib/video-timeline/timeline-ops";
import type { VisualClip } from "@/lib/video-timeline/timeline-types";

function clip(id: string, startSec: number, endSec: number, over: Partial<VisualClip> = {}): VisualClip {
  return {
    id,
    trackId: "v1",
    assetId: `a-${id}`,
    url: `u-${id}`,
    name: id,
    kind: "video",
    startSec,
    endSec,
    sourceStartSec: 0,
    sourceDurationSec: endSec - startSec,
    ...over,
  };
}

describe("effectiveTransitionSec", () => {
  it("is zero without a duration", () => {
    expect(effectiveTransitionSec(clip("a", 0, 4))).toBe(0);
    expect(effectiveTransitionSec(clip("a", 0, 4, { transitionDurationSec: -1 }))).toBe(0);
    expect(effectiveTransitionSec(clip("a", 0, 4, { transitionDurationSec: Number.NaN }))).toBe(0);
  });

  it("never exceeds half the clip", () => {
    expect(effectiveTransitionSec(clip("a", 0, 4, { transitionDurationSec: 0.25 }))).toBe(0.25);
    expect(effectiveTransitionSec(clip("a", 0, 0.4, { transitionDurationSec: 0.5 }))).toBeCloseTo(0.2);
  });
});

describe("previousAdjacentClip", () => {
  it("finds the clip ending where this one starts", () => {
    const a = clip("a", 0, 4);
    const b = clip("b", 4, 8);
    expect(previousAdjacentClip([a, b], b)?.id).toBe("a");
  });

  it("is null for the first clip and for gaps", () => {
    const a = clip("a", 0, 4);
    const c = clip("c", 6, 9);
    expect(previousAdjacentClip([a, c], a)).toBeNull();
    expect(previousAdjacentClip([a, c], c)).toBeNull();
  });
});

describe("transitionState", () => {
  const a = clip("a", 0, 4);
  const b = clip("b", 4, 8, { transition: "dissolve", transitionDurationSec: 0.25 });

  it("ramps a dissolve over the previous clip's last frame", () => {
    const mid = transitionState([a, b], b, 4.1);
    expect(mid.alpha).toBeCloseTo(0.4);
    expect(mid.underlay?.id).toBe("a");
    expect(transitionState([a, b], b, 4).alpha).toBe(0);
  });

  it("is opaque with no underlay once the window has passed", () => {
    expect(transitionState([a, b], b, 4.25)).toEqual({ alpha: 1, underlay: null });
    expect(transitionState([a, b], b, 6)).toEqual({ alpha: 1, underlay: null });
  });

  it("does not dissolve the first clip", () => {
    const first = clip("f", 0, 4, { transition: "dissolve", transitionDurationSec: 0.5 });
    expect(transitionState([first], first, 0.1)).toEqual({ alpha: 1, underlay: null });
  });

  it("skips the underlay when the previous clip is still active", () => {
    const overlapping = clip("a", 0, 4.2);
    expect(transitionState([overlapping, b], b, 4.1)).toEqual({ alpha: 1, underlay: null });
  });

  it("fades in from the background without an underlay", () => {
    const f = clip("f", 4, 8, { transition: "fade", transitionDurationSec: 0.5 });
    const s = transitionState([a, f], f, 4.25);
    expect(s.alpha).toBeCloseTo(0.5);
    expect(s.underlay).toBeNull();
  });

  it("ignores other transition types and none", () => {
    const wipe = clip("w", 4, 8, { transition: "wipe", transitionDurationSec: 0.5 });
    expect(transitionState([a, wipe], wipe, 4.1)).toEqual({ alpha: 1, underlay: null });
    expect(transitionState([a, b], a, 0.1)).toEqual({ alpha: 1, underlay: null });
  });
});
