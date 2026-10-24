export type GifDitherOption = boolean | "none" | "floyd-steinberg";

export interface GifFrameInput {
  width: number;
  height: number;
  data: Uint8ClampedArray | Uint8Array;
  delay?: number; // in milliseconds
}

/**
 * Calculates frame delay in ms from target FPS and speed multiplier.
 * Clamps minimum to 20ms to avoid browser 100ms throttle quirks.
 */
export function calculateFrameDelay(fps: number, speed = 1): number {
  const safeFps = Math.min(60, Math.max(1, fps));
  const safeSpeed = Math.min(10, Math.max(0.1, speed));
  const rawDelayMs = 1000 / safeFps / safeSpeed;
  return Math.max(20, Math.round(rawDelayMs));
}

/**
 * Maps user-friendly loop count to GIF Netscape extension repeat value.
 * 0 = infinite loop
 * 1 = play once (repeat: -1)
 * N = loop N times
 */
export function normalizeGifRepeat(loopCount: number): number {
  if (loopCount <= 0) return 0;
  if (loopCount === 1) return -1;
  return loopCount - 1;
}

/**
 * Estimates GIF byte size from dimensions, frame count, palette colors, and dithering.
 */
export function calculateEstimatedGifSize(
  width: number,
  height: number,
  frameCount: number,
  paletteColors = 256,
  dither: GifDitherOption = false,
): number {
  if (width <= 0 || height <= 0 || frameCount <= 0) return 0;
  const isDithered = dither === true || dither === "floyd-steinberg";
  const colorRatio = Math.min(1, Math.max(0.1, paletteColors / 256));
  const compressionRatio = isDithered ? 0.65 : 0.42;
  const perFramePixels = width * height;
  const perFrameBytes = perFramePixels * compressionRatio * colorRatio + 768;
  return Math.round(frameCount * perFrameBytes + 1024);
}

/**
 * Creates a boomerang sequence (forward then reverse, avoiding end duplication).
 */
export function buildBoomerangFrames<T>(frames: T[]): T[] {
  if (frames.length <= 2) return [...frames];
  const middleReversed = frames.slice(1, -1).reverse();
  return [...frames, ...middleReversed];
}

/**
 * Reverses frame order.
 */
export function reverseFrames<T>(frames: T[]): T[] {
  return [...frames].reverse();
}

/**
 * Generates sample timestamps in seconds across a video clip.
 */
export function sampleVideoTimes(
  duration: number,
  fps: number,
  startTime = 0,
  endTime = duration,
): number[] {
  if (duration <= 0 || fps <= 0) return [];
  const start = Math.max(0, Math.min(duration, startTime));
  const end = Math.max(start, Math.min(duration, endTime));
  const span = end - start;
  if (span <= 0) return [start];
  const step = 1 / fps;
  const times: number[] = [];
  for (let t = start; t <= end + 0.0001; t += step) {
    times.push(Math.min(end, Math.round(t * 1000) / 1000));
  }
  return times;
}

/**
 * Deterministic Floyd-Steinberg error-diffusion dithering for palette mapping.
 */
export function applyFloydSteinbergDither(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  palette: number[][],
): Uint8Array {
  const length = width * height;
  const index = new Uint8Array(length);

  const rArr = new Float32Array(length);
  const gArr = new Float32Array(length);
  const bArr = new Float32Array(length);

  for (let i = 0; i < length; i++) {
    rArr[i] = rgba[i * 4];
    gArr[i] = rgba[i * 4 + 1];
    bArr[i] = rgba[i * 4 + 2];
  }

  const palLen = palette.length;
  const palR = new Uint8Array(palLen);
  const palG = new Uint8Array(palLen);
  const palB = new Uint8Array(palLen);
  for (let i = 0; i < palLen; i++) {
    palR[i] = palette[i][0];
    palG[i] = palette[i][1];
    palB[i] = palette[i][2];
  }

  const findClosestIndex = (r: number, g: number, b: number): number => {
    let minD = Infinity;
    let bestIdx = 0;
    for (let j = 0; j < palLen; j++) {
      const dr = r - palR[j];
      const dg = g - palG[j];
      const db = b - palB[j];
      const d = dr * dr + dg * dg + db * db;
      if (d < minD) {
        minD = d;
        bestIdx = j;
        if (d === 0) break;
      }
    }
    return bestIdx;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const r = Math.min(255, Math.max(0, rArr[idx]));
      const g = Math.min(255, Math.max(0, gArr[idx]));
      const b = Math.min(255, Math.max(0, bArr[idx]));

      const colorIdx = findClosestIndex(r, g, b);
      index[idx] = colorIdx;

      const errR = r - palR[colorIdx];
      const errG = g - palG[colorIdx];
      const errB = b - palB[colorIdx];

      if (x + 1 < width) {
        const nextIdx = idx + 1;
        rArr[nextIdx] += (errR * 7) / 16;
        gArr[nextIdx] += (errG * 7) / 16;
        bArr[nextIdx] += (errB * 7) / 16;
      }
      if (y + 1 < height) {
        if (x > 0) {
          const blIdx = (y + 1) * width + (x - 1);
          rArr[blIdx] += (errR * 3) / 16;
          gArr[blIdx] += (errG * 3) / 16;
          bArr[blIdx] += (errB * 3) / 16;
        }
        const bIdx = (y + 1) * width + x;
        rArr[bIdx] += (errR * 5) / 16;
        gArr[bIdx] += (errG * 5) / 16;
        bArr[bIdx] += (errB * 5) / 16;

        if (x + 1 < width) {
          const brIdx = (y + 1) * width + (x + 1);
          rArr[brIdx] += (errR * 1) / 16;
          gArr[brIdx] += (errG * 1) / 16;
          bArr[brIdx] += (errB * 1) / 16;
        }
      }
    }
  }

  return index;
}
