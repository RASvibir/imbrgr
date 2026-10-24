import { describe, expect, it } from "vitest";
import { AR_EFFECTS, renderArEffect, type ArEffectId, type EffectRenderContext } from "./ar-effects";
import { getHeadPose, type Landmark } from "./ar-geometry";

describe("AR Effects rendering system", () => {
  it("exports all required effect metadata", () => {
    expect(AR_EFFECTS.length).toBeGreaterThanOrEqual(9);
    const ids = AR_EFFECTS.map((e) => e.id);
    expect(ids).toContain("burger-hat");
    expect(ids).toContain("burger-frame");
    expect(ids).toContain("sesame-freckles");
    expect(ids).toContain("ketchup-mustard");
    expect(ids).toContain("cheese-melt");
    expect(ids).toContain("flame-halo");
    expect(ids).toContain("sunglasses");
    expect(ids).toContain("pixel-mask");
    expect(ids).toContain("retro-hud");
    expect(ids).toContain("fun-filter");
  });

  it("safely handles 0 intensity as a no-op", () => {
    const dummyCtx = {
      save: () => {},
      restore: () => {},
    } as unknown as CanvasRenderingContext2D;

    const dummyLandmarks: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    const pose = getHeadPose(dummyLandmarks, 640, 480);

    const rc: EffectRenderContext = {
      ctx: dummyCtx,
      pose,
      landmarks: dummyLandmarks,
      canvasWidth: 640,
      canvasHeight: 480,
      mirror: false,
      intensity: 0,
      timeSec: 1.0,
    };

    // Calling any effect with intensity 0 should return cleanly without throwing
    AR_EFFECTS.forEach((effect) => {
      expect(() => renderArEffect(effect.id as ArEffectId, rc)).not.toThrow();
    });
  });

  it("dispatches all effects without throwing on mock canvas context", () => {
    const recordedOps: string[] = [];
    const mockCtx = {
      save: () => recordedOps.push("save"),
      restore: () => recordedOps.push("restore"),
      translate: () => recordedOps.push("translate"),
      rotate: () => recordedOps.push("rotate"),
      beginPath: () => recordedOps.push("beginPath"),
      closePath: () => recordedOps.push("closePath"),
      moveTo: () => recordedOps.push("moveTo"),
      lineTo: () => recordedOps.push("lineTo"),
      quadraticCurveTo: () => recordedOps.push("quadraticCurveTo"),
      bezierCurveTo: () => recordedOps.push("bezierCurveTo"),
      arc: () => recordedOps.push("arc"),
      ellipse: () => recordedOps.push("ellipse"),
      roundRect: () => recordedOps.push("roundRect"),
      fill: () => recordedOps.push("fill"),
      stroke: () => recordedOps.push("stroke"),
      fillRect: () => recordedOps.push("fillRect"),
      strokeRect: () => recordedOps.push("strokeRect"),
      fillText: () => recordedOps.push("fillText"),
      createLinearGradient: () => ({ addColorStop: () => {} }),
      createRadialGradient: () => ({ addColorStop: () => {} }),
      getImageData: () => ({
        width: 10,
        height: 10,
        data: new Uint8ClampedArray(400),
      }),
      putImageData: () => recordedOps.push("putImageData"),
    } as unknown as CanvasRenderingContext2D;

    const dummyLandmarks: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    const pose = getHeadPose(dummyLandmarks, 640, 480);

    const rc: EffectRenderContext = {
      ctx: mockCtx,
      pose,
      landmarks: dummyLandmarks,
      canvasWidth: 640,
      canvasHeight: 480,
      mirror: false,
      intensity: 1.0,
      timeSec: 0.5,
      funFilterId: "flame-grilled",
    };

    AR_EFFECTS.forEach((effect) => {
      expect(() => renderArEffect(effect.id as ArEffectId, rc)).not.toThrow();
    });

    expect(recordedOps.length).toBeGreaterThan(10);
  });
});
