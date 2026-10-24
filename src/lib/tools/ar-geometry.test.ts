import { describe, expect, it } from "vitest";
import {
  distance2D,
  angle2D,
  lerp,
  clamp,
  normalizePoint,
  getFaceBounds,
  getHeadRotation,
  getHeadPose,
  rotatePoint,
  transformPoint,
  deterministicHash,
  getFreckleOffsets,
  FACE_LANDMARKS,
  type Landmark,
} from "./ar-geometry";

describe("ar-geometry pure math helpers", () => {
  it("distance2D calculates exact Euclidean distance", () => {
    expect(distance2D({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(distance2D({ x: 10, y: 20 }, { x: 10, y: 20 })).toBe(0);
    expect(distance2D({ x: -2, y: 3 }, { x: 4, y: 11 })).toBe(10);
  });

  it("angle2D calculates direction in radians", () => {
    expect(angle2D({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(angle2D({ x: 0, y: 0 }, { x: 0, y: 10 })).toBeCloseTo(Math.PI / 2);
    expect(angle2D({ x: 0, y: 0 }, { x: -10, y: 0 })).toBeCloseTo(Math.PI);
    expect(angle2D({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(-Math.PI / 2);
  });

  it("lerp interpolates correctly", () => {
    expect(lerp(0, 100, 0)).toBe(0);
    expect(lerp(0, 100, 0.5)).toBe(50);
    expect(lerp(0, 100, 1)).toBe(100);
    expect(lerp(20, 40, 0.25)).toBe(25);
  });

  it("clamp restricts numbers within bounds", () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it("normalizePoint converts normalized coords to pixel space and handles mirroring", () => {
    const lm: Landmark = { x: 0.25, y: 0.5 };
    // Normal (unmirrored)
    const normal = normalizePoint(lm, 800, 600, false);
    expect(normal).toEqual({ x: 200, y: 300 });

    // Mirrored (for front camera selfie mode)
    const mirrored = normalizePoint(lm, 800, 600, true);
    expect(mirrored).toEqual({ x: 600, y: 300 });
  });

  it("getFaceBounds computes correct bounding box", () => {
    const lms: Landmark[] = [
      { x: 0.2, y: 0.3 },
      { x: 0.6, y: 0.3 },
      { x: 0.4, y: 0.8 },
    ];
    const bounds = getFaceBounds(lms, 1000, 1000, false);
    expect(bounds.minX).toBe(200);
    expect(bounds.maxX).toBe(600);
    expect(bounds.minY).toBe(300);
    expect(bounds.maxY).toBe(800);
    expect(bounds.width).toBe(400);
    expect(bounds.height).toBe(500);
    expect(bounds.centerX).toBe(400);
    expect(bounds.centerY).toBe(550);

    // Empty list returns zeros
    const emptyBounds = getFaceBounds([], 1000, 1000);
    expect(emptyBounds.width).toBe(0);
  });

  it("rotatePoint rotates a point around an origin", () => {
    const origin = { x: 100, y: 100 };
    const pt = { x: 150, y: 100 };
    // 90 degrees clockwise (positive angle in canvas space)
    const rotated = rotatePoint(pt, origin, Math.PI / 2);
    expect(rotated.x).toBeCloseTo(100);
    expect(rotated.y).toBeCloseTo(150);
  });

  it("transformPoint rotates and scales relative to an origin", () => {
    const origin = { x: 10, y: 20 };
    const pt = { x: 20, y: 20 };
    const scaled = transformPoint(pt, origin, 0, 2.5);
    expect(scaled.x).toBeCloseTo(35);
    expect(scaled.y).toBeCloseTo(20);
  });

  it("deterministicHash produces repeatable values in [0, 1)", () => {
    const val1 = deterministicHash(12, 34, 99);
    const val2 = deterministicHash(12, 34, 99);
    expect(val1).toBe(val2);
    expect(val1).toBeGreaterThanOrEqual(0);
    expect(val1).toBeLessThan(1);

    const valDiff = deterministicHash(13, 34, 99);
    expect(valDiff).not.toBe(val1);
  });

  it("getFreckleOffsets returns consistent deterministic freckle array", () => {
    const offsets1 = getFreckleOffsets();
    const offsets2 = getFreckleOffsets();
    expect(offsets1).toEqual(offsets2);
    expect(offsets1.length).toBeGreaterThanOrEqual(10);
    offsets1.forEach((f) => {
      expect(f.u).toBeGreaterThanOrEqual(-1);
      expect(f.u).toBeLessThanOrEqual(1);
      expect(f.scale).toBeGreaterThan(0);
    });
  });

  it("getHeadRotation and getHeadPose extract landmarks and orientations", () => {
    // Generate a dummy set of 478 landmarks
    const landmarks: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));

    // Set key landmarks
    landmarks[FACE_LANDMARKS.FOREHEAD] = { x: 0.5, y: 0.2 };
    landmarks[FACE_LANDMARKS.CHIN] = { x: 0.5, y: 0.8 };
    landmarks[FACE_LANDMARKS.NOSE_TIP] = { x: 0.5, y: 0.5 };
    landmarks[FACE_LANDMARKS.LEFT_EYE_OUTER] = { x: 0.65, y: 0.4 }; // viewer's right
    landmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER] = { x: 0.35, y: 0.4 }; // viewer's left
    landmarks[FACE_LANDMARKS.LEFT_CHEEK] = { x: 0.75, y: 0.5 };
    landmarks[FACE_LANDMARKS.RIGHT_CHEEK] = { x: 0.25, y: 0.5 };
    landmarks[FACE_LANDMARKS.MOUTH_TOP] = { x: 0.5, y: 0.65 };
    landmarks[FACE_LANDMARKS.MOUTH_BOTTOM] = { x: 0.5, y: 0.70 };
    landmarks[FACE_LANDMARKS.MOUTH_LEFT_CORNER] = { x: 0.6, y: 0.675 };
    landmarks[FACE_LANDMARKS.MOUTH_RIGHT_CORNER] = { x: 0.4, y: 0.675 };

    const rot = getHeadRotation(landmarks, false);
    // Level eyes horizontally => roll is approximately 0
    expect(rot.roll).toBeCloseTo(0, 2);
    // Centered nose => yaw is approximately 0
    expect(rot.yaw).toBeCloseTo(0, 2);

    const pose = getHeadPose(landmarks, 1000, 1000, false);
    expect(pose.eyeDistance).toBeCloseTo(300);
    expect(pose.mouthWidth).toBeCloseTo(200);
    expect(pose.noseTip.x).toBe(500);
    expect(pose.noseTip.y).toBe(500);
    expect(pose.forehead.y).toBe(200);
    expect(pose.chin.y).toBe(800);
    expect(pose.mouthCenter.y).toBeCloseTo(675);
    expect(pose.scale).toBeGreaterThan(0);
  });

  it("getHeadRotation computes roll when head is tilted", () => {
    const landmarks: Landmark[] = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
    // Tilt head: left eye lower than right eye (tilted clockwise)
    landmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER] = { x: 0.35, y: 0.35 };
    landmarks[FACE_LANDMARKS.LEFT_EYE_OUTER] = { x: 0.65, y: 0.45 };
    landmarks[FACE_LANDMARKS.FOREHEAD] = { x: 0.5, y: 0.2 };
    landmarks[FACE_LANDMARKS.CHIN] = { x: 0.5, y: 0.8 };
    landmarks[FACE_LANDMARKS.NOSE_TIP] = { x: 0.5, y: 0.5 };
    landmarks[FACE_LANDMARKS.LEFT_CHEEK] = { x: 0.75, y: 0.5 };
    landmarks[FACE_LANDMARKS.RIGHT_CHEEK] = { x: 0.25, y: 0.5 };

    const rot = getHeadRotation(landmarks, false);
    expect(rot.roll).toBeGreaterThan(0); // Clockwise tilt
  });
});
