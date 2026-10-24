/**
 * Pure geometry helpers for AR camera landmark-to-transform math.
 * Deterministic: NO Math.random() is used, ensuring exact reproducibility in tests.
 */

export type Landmark = {
  x: number;
  y: number;
  z?: number;
};

export type Point2D = {
  x: number;
  y: number;
};

export type BoundingBox = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
};

export type HeadPose = {
  roll: number; // In radians (Z-axis rotation, head tilt left/right)
  pitch: number; // Normalized approx -1 to 1 (X-axis rotation, looking up/down)
  yaw: number; // Normalized approx -1 to 1 (Y-axis rotation, looking left/right)
  scale: number; // In pixels (distance between temples/cheeks or eyes)
  center: Point2D; // Midpoint between eyes/nose
  forehead: Point2D; // Hairline/forehead top center (landmark 10)
  chin: Point2D; // Bottom of chin (landmark 152)
  leftEye: Point2D; // Subject's left eye (viewer's right, landmark 263 or 33 if mirrored)
  rightEye: Point2D; // Subject's right eye (viewer's left, landmark 33 or 263 if mirrored)
  eyeDistance: number; // In pixels
  noseTip: Point2D; // Tip of nose (landmark 1)
  mouthCenter: Point2D; // Center between lips (landmark 13/14)
  mouthLeft: Point2D; // Subject's left mouth corner (landmark 291)
  mouthRight: Point2D; // Subject's right mouth corner (landmark 61)
  mouthWidth: number; // Distance between mouth corners in pixels
  leftCheek: Point2D; // Landmark 454 (or 234 if mirrored)
  rightCheek: Point2D; // Landmark 234 (or 454 if mirrored)
  bounds: BoundingBox;
};

/** Key landmark indices in the MediaPipe 468/478 Face Mesh model */
export const FACE_LANDMARKS = {
  FOREHEAD: 10,
  CHIN: 152,
  NOSE_TIP: 1,
  NOSE_BRIDGE: 168,
  LEFT_EYE_OUTER: 263, // Subject's left (viewer's right in unmirrored)
  RIGHT_EYE_OUTER: 33, // Subject's right (viewer's left in unmirrored)
  LEFT_EYE_INNER: 362,
  RIGHT_EYE_INNER: 133,
  MOUTH_TOP: 0,
  MOUTH_BOTTOM: 17,
  MOUTH_CENTER_UPPER: 13,
  MOUTH_CENTER_LOWER: 14,
  MOUTH_LEFT_CORNER: 291, // Subject's left
  MOUTH_RIGHT_CORNER: 61, // Subject's right
  LEFT_CHEEK: 454, // Subject's left
  RIGHT_CHEEK: 234, // Subject's right
  MID_EYES: 168,
} as const;

/** Euclidean distance between two 2D points */
export function distance2D(p1: Point2D, p2: Point2D): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.hypot(dx, dy);
}

/** Angle in radians from p1 to p2 (-PI to PI) */
export function angle2D(from: Point2D, to: Point2D): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/** Linear interpolation */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Clamp a value between min and max */
export function clamp(val: number, min: number, max: number): number {
  return val < min ? min : val > max ? max : val;
}

/** Convert normalized [0, 1] landmark coordinates to canvas pixel coordinates */
export function normalizePoint(
  lm: Landmark,
  canvasWidth: number,
  canvasHeight: number,
  mirror = false,
): Point2D {
  const x = mirror ? (1 - lm.x) * canvasWidth : lm.x * canvasWidth;
  const y = lm.y * canvasHeight;
  return { x, y };
}

/** Compute axis-aligned bounding box around a set of landmarks */
export function getFaceBounds(
  landmarks: Landmark[],
  canvasWidth: number,
  canvasHeight: number,
  mirror = false,
): BoundingBox {
  if (!landmarks || landmarks.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0, centerX: 0, centerY: 0 };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < landmarks.length; i++) {
    const p = normalizePoint(landmarks[i], canvasWidth, canvasHeight, mirror);
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const centerX = minX + width / 2;
  const centerY = minY + height / 2;

  return { minX, minY, maxX, maxY, width, height, centerX, centerY };
}

/**
 * Calculates head orientation:
 * - roll: rotation around Z axis in radians (positive = tilted clockwise on canvas)
 * - pitch: rough rotation around X axis (positive = looking down, negative = looking up)
 * - yaw: rough rotation around Y axis (positive = turned right, negative = turned left)
 */
export function getHeadRotation(
  landmarks: Landmark[],
  mirror = false,
): { roll: number; pitch: number; yaw: number } {
  if (!landmarks || landmarks.length <= Math.max(FACE_LANDMARKS.LEFT_EYE_OUTER, FACE_LANDMARKS.RIGHT_EYE_OUTER)) {
    return { roll: 0, pitch: 0, yaw: 0 };
  }

  // Right eye (33) and Left eye (263)
  const rightEyeRaw = landmarks[FACE_LANDMARKS.RIGHT_EYE_OUTER];
  const leftEyeRaw = landmarks[FACE_LANDMARKS.LEFT_EYE_OUTER];

  const rx = mirror ? 1 - rightEyeRaw.x : rightEyeRaw.x;
  const ry = rightEyeRaw.y;
  const lx = mirror ? 1 - leftEyeRaw.x : leftEyeRaw.x;
  const ly = leftEyeRaw.y;

  // On canvas, subject's right eye is to the left when not mirrored
  // With mirror, lx and rx flip relative positions
  const dx = mirror ? rx - lx : lx - rx;
  const dy = mirror ? ry - ly : ly - ry;
  const roll = Math.atan2(dy, dx);

  // Pitch: compare nose tip Y to the eye line Y vs chin Y
  const nose = landmarks[FACE_LANDMARKS.NOSE_TIP];
  const forehead = landmarks[FACE_LANDMARKS.FOREHEAD];
  const chin = landmarks[FACE_LANDMARKS.CHIN];

  const upperHalf = nose.y - forehead.y;
  const lowerHalf = chin.y - nose.y;
  const totalH = upperHalf + lowerHalf;
  // If looking down, nose is lower (lowerHalf smaller, pitch > 0)
  const pitch = totalH > 0.001 ? clamp((upperHalf - lowerHalf) / totalH, -1, 1) : 0;

  // Yaw: compare nose tip X relative to center between cheeks
  const leftCheek = landmarks[FACE_LANDMARKS.LEFT_CHEEK];
  const rightCheek = landmarks[FACE_LANDMARKS.RIGHT_CHEEK];
  const lcx = mirror ? 1 - leftCheek.x : leftCheek.x;
  const rcx = mirror ? 1 - rightCheek.x : rightCheek.x;
  const cheekMidX = (lcx + rcx) / 2;
  const noseX = mirror ? 1 - nose.x : nose.x;
  const cheekSpan = Math.abs(lcx - rcx);
  const yaw = cheekSpan > 0.001 ? clamp(((noseX - cheekMidX) / cheekSpan) * 2, -1, 1) : 0;

  return { roll, pitch, yaw };
}

/** Extracts complete head pose and landmark anchor points mapped to canvas coordinates */
export function getHeadPose(
  landmarks: Landmark[],
  canvasWidth: number,
  canvasHeight: number,
  mirror = false,
): HeadPose {
  const bounds = getFaceBounds(landmarks, canvasWidth, canvasHeight, mirror);
  const { roll, pitch, yaw } = getHeadRotation(landmarks, mirror);

  const getPt = (idx: number): Point2D => {
    if (!landmarks || idx >= landmarks.length || idx < 0) {
      return { x: bounds.centerX, y: bounds.centerY };
    }
    return normalizePoint(landmarks[idx], canvasWidth, canvasHeight, mirror);
  };

  const forehead = getPt(FACE_LANDMARKS.FOREHEAD);
  const chin = getPt(FACE_LANDMARKS.CHIN);
  const noseTip = getPt(FACE_LANDMARKS.NOSE_TIP);
  const mouthTop = getPt(FACE_LANDMARKS.MOUTH_TOP);
  const mouthBottom = getPt(FACE_LANDMARKS.MOUTH_BOTTOM);
  const mouthCenter = {
    x: (mouthTop.x + mouthBottom.x) / 2,
    y: (mouthTop.y + mouthBottom.y) / 2,
  };

  const mouthLeft = getPt(FACE_LANDMARKS.MOUTH_LEFT_CORNER);
  const mouthRight = getPt(FACE_LANDMARKS.MOUTH_RIGHT_CORNER);
  const mouthWidth = distance2D(mouthLeft, mouthRight);

  const leftEye = getPt(FACE_LANDMARKS.LEFT_EYE_OUTER);
  const rightEye = getPt(FACE_LANDMARKS.RIGHT_EYE_OUTER);
  const eyeDistance = distance2D(leftEye, rightEye);

  const leftCheek = getPt(FACE_LANDMARKS.LEFT_CHEEK);
  const rightCheek = getPt(FACE_LANDMARKS.RIGHT_CHEEK);
  const scale = Math.max(eyeDistance * 2.2, distance2D(leftCheek, rightCheek));

  const center: Point2D = {
    x: (leftEye.x + rightEye.x) / 2,
    y: (leftEye.y + rightEye.y) / 2,
  };

  return {
    roll,
    pitch,
    yaw,
    scale,
    center,
    forehead,
    chin,
    leftEye,
    rightEye,
    eyeDistance,
    noseTip,
    mouthCenter,
    mouthLeft,
    mouthRight,
    mouthWidth,
    leftCheek,
    rightCheek,
    bounds,
  };
}

/** Rotate a 2D point around an origin point by angle in radians */
export function rotatePoint(p: Point2D, origin: Point2D, angleRad: number): Point2D {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = p.x - origin.x;
  const dy = p.y - origin.y;
  return {
    x: origin.x + (dx * cos - dy * sin),
    y: origin.y + (dx * sin + dy * cos),
  };
}

/** Rotate and scale a 2D point relative to an origin point */
export function transformPoint(
  p: Point2D,
  origin: Point2D,
  angleRad: number,
  scale = 1,
): Point2D {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const dx = (p.x - origin.x) * scale;
  const dy = (p.y - origin.y) * scale;
  return {
    x: origin.x + (dx * cos - dy * sin),
    y: origin.y + (dx * sin + dy * cos),
  };
}

/** Deterministic pseudo-random float [0, 1) based on integer coordinates / seed */
export function deterministicHash(x: number, y: number, seed = 42): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * Pre-computed deterministic layout for sesame freckles across cheeks and nose.
 * Returns relative [u, v] offsets from cheek/nose anchors.
 */
export function getFreckleOffsets(): { u: number; v: number; scale: number; rotation: number }[] {
  const seeds: { u: number; v: number; scale: number; rotation: number }[] = [];
  // 14 fixed freckles on left cheek, right cheek, and nose bridge
  const count = 18;
  for (let i = 0; i < count; i++) {
    const h1 = deterministicHash(i, 11, 7);
    const h2 = deterministicHash(i, 23, 19);
    const h3 = deterministicHash(i, 37, 31);
    const h4 = deterministicHash(i, 49, 43);
    seeds.push({
      u: (h1 - 0.5) * 2, // -1 to 1
      v: (h2 - 0.5) * 2,
      scale: 0.7 + h3 * 0.6,
      rotation: h4 * Math.PI,
    });
  }
  return seeds;
}
