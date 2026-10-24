/**
 * imbrgr Photo Filters — pure, high-performance ImageData preset operations.
 *
 * Designed for both static photo editing (ImageEditor, /tools/filters)
 * and real-time video frames (VideoPreviewPlayer, pacNcap plugin pipeline).
 * Deterministic: no Math.random, fully repeatable and unit-tested.
 */

export type PhotoFilterCategory =
  | "cinematic"
  | "vintage"
  | "monochrome"
  | "artistic"
  | "mood"
  | "duotone";

export interface PhotoFilterOptions {
  /** Video timeline seconds (used for organic grain drift, etc.). Static images use 0. */
  timeSec?: number;
  /** 0–1 blend of the filter over original pixels (default 1). */
  intensity?: number;
}

export interface PhotoFilterDef {
  id: string;
  label: string;
  category: PhotoFilterCategory;
  description: string;
  emoji: string;
  /** True when the look evolves over video time. */
  animated: boolean;
  apply: (img: ImageData, timeSec?: number, intensity?: number) => void;
}

// ---------------------------------------------------------------------------
// Pure Math & Color Transform Primitives
// ---------------------------------------------------------------------------

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
export const clamp255 = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/**
 * Deterministic 2D integer hash -> [0, 1).
 * Fast, seedable, zero Math.random.
 */
export function hash2(x: number, y: number, seed = 0): number {
  let h =
    (Math.imul(x | 0, 374761393) +
      Math.imul(y | 0, 668265263) +
      Math.imul(seed | 0, 1442695041)) |
    0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Standard Rec. 709 luminance (0–255). */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/**
 * Apply 1D lookup tables to R, G, and B channels.
 * Preserves alpha.
 */
export function applyLut1D(
  img: ImageData,
  rLut: Uint8Array | number[],
  gLut: Uint8Array | number[],
  bLut: Uint8Array | number[],
): void {
  const d = img.data;
  const len = d.length;
  for (let i = 0; i < len; i += 4) {
    d[i] = rLut[d[i]];
    d[i + 1] = gLut[d[i + 1]];
    d[i + 2] = bLut[d[i + 2]];
  }
}

/** Generate a 256-entry tone curve LUT using an S-curve contrast / gamma equation. */
export function makeToneCurve(gamma = 1, contrast = 0, lift = 0, ceiling = 255): Uint8Array {
  const lut = new Uint8Array(256);
  for (let i = 0; i < 256; i++) {
    let t = i / 255;
    if (gamma !== 1) {
      t = Math.pow(t, 1 / gamma);
    }
    if (contrast !== 0) {
      // S-curve contrast centered at 0.5
      const factor = (1 + contrast) / (1 - Math.min(0.99, Math.max(-0.99, contrast)));
      t = (t - 0.5) * factor + 0.5;
    }
    t = Math.max(0, Math.min(1, t));
    lut[i] = clamp255(lift + t * (ceiling - lift));
  }
  return lut;
}

/**
 * Apply 3x3 channel mixing matrix with optional channel bias.
 * [ [rr, rg, rb, biasR], [gr, gg, gb, biasG], [br, bg, bb, biasB] ]
 */
export function applyChannelMix(img: ImageData, matrix: number[][]): void {
  const d = img.data;
  const len = d.length;
  const [mr, mg, mb] = matrix;
  for (let i = 0; i < len; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    d[i] = clamp255(r * mr[0] + g * mr[1] + b * mr[2] + (mr[3] ?? 0));
    d[i + 1] = clamp255(r * mg[0] + g * mg[1] + b * mg[2] + (mg[3] ?? 0));
    d[i + 2] = clamp255(r * mb[0] + g * mb[1] + b * mb[2] + (mb[3] ?? 0));
  }
}

/**
 * Apply natural optical vignette (radial falloff towards corners).
 */
export function applyVignetteImageData(
  img: ImageData,
  innerRatio = 0.35,
  outerRatio = 1.05,
  darkness = 0.6,
): void {
  const { width: w, height: h, data: d } = img;
  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.hypot(cx, cy);
  const r0 = maxR * innerRatio;
  const r1 = maxR * outerRatio;
  const span = Math.max(1, r1 - r0);

  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    for (let x = 0; x < w; x++) {
      const dx = x - cx;
      const dist = Math.hypot(dx, dy);
      if (dist <= r0) continue;
      const t = Math.min(1, (dist - r0) / span);
      // Smooth cosine falloff
      const factor = 1 - (1 - Math.cos(t * Math.PI)) * 0.5 * darkness;
      const i = (y * w + x) * 4;
      d[i] = Math.round(d[i] * factor);
      d[i + 1] = Math.round(d[i + 1] * factor);
      d[i + 2] = Math.round(d[i + 2] * factor);
    }
  }
}

/**
 * Seeded, deterministic film grain with midtone concentration.
 */
export function applyFilmGrain(
  img: ImageData,
  strength = 24,
  timeSec = 0,
  seed = 42,
): void {
  const { width: w, data: d } = img;
  const frameSeed = Math.floor(timeSec * 30);
  const totalSeed = (seed + frameSeed * 1013) | 0;

  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const x = p % w;
    const y = (p / w) | 0;
    const lum = luminance(d[i], d[i + 1], d[i + 2]) / 255;
    // Bell curve: grain is most prominent in midtones, softer in deep blacks and bright whites
    const midtoneWeight = 1 - 2 * Math.abs(lum - 0.5);
    const noise = (hash2(x, y, totalSeed) - 0.5) * 2 * strength * midtoneWeight;

    d[i] = clamp255(d[i] + noise);
    d[i + 1] = clamp255(d[i + 1] + noise);
    d[i + 2] = clamp255(d[i + 2] + noise);
  }
}

/**
 * Fast separable box blur for pure ImageData (without DOM canvas dependencies).
 */
export function applyFastBlur(img: ImageData, radius: number): void {
  if (radius <= 0) return;
  const { width: w, height: h, data: d } = img;
  const r = Math.min(24, Math.max(1, Math.round(radius)));
  const src = new Uint8ClampedArray(d);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const rowOffset = y * w * 4;
    for (let x = 0; x < w; x++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      const xStart = Math.max(0, x - r);
      const xEnd = Math.min(w - 1, x + r);
      for (let kx = xStart; kx <= xEnd; kx++) {
        const idx = rowOffset + kx * 4;
        rSum += src[idx];
        gSum += src[idx + 1];
        bSum += src[idx + 2];
        count++;
      }
      const outIdx = rowOffset + x * 4;
      d[outIdx] = rSum / count;
      d[outIdx + 1] = gSum / count;
      d[outIdx + 2] = bSum / count;
    }
  }

  // Vertical pass
  const temp = new Uint8ClampedArray(d);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let count = 0;
      const yStart = Math.max(0, y - r);
      const yEnd = Math.min(h - 1, y + r);
      for (let ky = yStart; ky <= yEnd; ky++) {
        const idx = (ky * w + x) * 4;
        rSum += temp[idx];
        gSum += temp[idx + 1];
        bSum += temp[idx + 2];
        count++;
      }
      const outIdx = (y * w + x) * 4;
      d[outIdx] = rSum / count;
      d[outIdx + 1] = gSum / count;
      d[outIdx + 2] = bSum / count;
    }
  }
}

/**
 * Dreamy bloom glow: extracts highlights above threshold, blurs them,
 * and screen-blends them additively over the base image.
 */
export function applyBloomGlow(
  img: ImageData,
  threshold = 185,
  blurRadius = 6,
  intensity = 0.65,
): void {
  const { width: w, height: h, data: d } = img;
  const glowData = new Uint8ClampedArray(d.length);

  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]);
    if (lum > threshold) {
      const factor = (lum - threshold) / (255 - threshold);
      glowData[i] = d[i] * factor;
      glowData[i + 1] = d[i + 1] * factor;
      glowData[i + 2] = d[i + 2] * factor;
      glowData[i + 3] = 255;
    }
  }

  const glowImg: ImageData = {
    data: glowData,
    width: w,
    height: h,
    colorSpace: img.colorSpace ?? "srgb",
  } as ImageData;

  applyFastBlur(glowImg, blurRadius);

  // Screen blend glow into original: 255 - ((255 - base) * (255 - glow * intensity)) / 255
  for (let i = 0; i < d.length; i += 4) {
    const gr = glowData[i] * intensity;
    const gg = glowData[i + 1] * intensity;
    const gb = glowData[i + 2] * intensity;

    d[i] = clamp255(255 - ((255 - d[i]) * (255 - gr)) / 255);
    d[i + 1] = clamp255(255 - ((255 - d[i + 1]) * (255 - gg)) / 255);
    d[i + 2] = clamp255(255 - ((255 - d[i + 2]) * (255 - gb)) / 255);
  }
}

/**
 * Duotone gradient map: maps black-to-white luminance between two colors.
 */
export function applyDuotone(
  img: ImageData,
  colorDark: [number, number, number],
  colorLight: [number, number, number],
): void {
  const d = img.data;
  const len = d.length;
  for (let i = 0; i < len; i += 4) {
    const t = luminance(d[i], d[i + 1], d[i + 2]) / 255;
    d[i] = clamp255(lerp(colorDark[0], colorLight[0], t));
    d[i + 1] = clamp255(lerp(colorDark[1], colorLight[1], t));
    d[i + 2] = clamp255(lerp(colorDark[2], colorLight[2], t));
  }
}

/**
 * Helper to wrap any core filter transform with intensity blending.
 */
function withIntensity(
  img: ImageData,
  intensity: number | undefined,
  transform: () => void,
): void {
  const amount = clamp01(intensity ?? 1);
  if (amount <= 0) return;
  if (amount >= 1) {
    transform();
    return;
  }
  const original = new Uint8ClampedArray(img.data);
  transform();
  const d = img.data;
  for (let i = 0; i < d.length; i++) {
    if (i % 4 === 3) continue; // Keep alpha intact
    d[i] = Math.round(original[i] + (d[i] - original[i]) * amount);
  }
}

// ---------------------------------------------------------------------------
// 26 Individual Filter Implementations
// ---------------------------------------------------------------------------

/** 1. Cinematic Teal & Orange */
function applyTealOrange(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]) / 255;
    if (lum < 0.5) {
      // Shadows push cyan/teal
      const t = (0.5 - lum) * 2;
      d[i] = clamp255(d[i] * (1 - 0.28 * t));
      d[i + 1] = clamp255(d[i + 1] * (1 + 0.12 * t));
      d[i + 2] = clamp255(d[i + 2] * (1 + 0.38 * t) + 15 * t);
    } else {
      // Highlights push warm amber/orange
      const t = (lum - 0.5) * 2;
      d[i] = clamp255(d[i] * (1 + 0.22 * t) + 20 * t);
      d[i + 1] = clamp255(d[i + 1] * (1 + 0.08 * t) + 8 * t);
      d[i + 2] = clamp255(d[i + 2] * (1 - 0.25 * t));
    }
  }
  applyVignetteImageData(img, 0.45, 1.1, 0.35);
}

/** 2. 35mm Film Grain */
function applyFilmGrainFilter(img: ImageData, timeSec: number): void {
  const curve = makeToneCurve(0.96, 0.12, 10, 250);
  applyLut1D(img, curve, curve, curve);
  applyFilmGrain(img, 30, timeSec, 99);
  applyVignetteImageData(img, 0.4, 1.1, 0.25);
}

/** 3. Faded Matte */
function applyFadedMatte(img: ImageData): void {
  const curve = makeToneCurve(1.05, -0.08, 32, 230);
  applyLut1D(img, curve, curve, curve);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]);
    d[i] = lerp(d[i], lum, 0.15) * 1.02;
    d[i + 1] = lerp(d[i + 1], lum, 0.15) * 1.01;
    d[i + 2] = lerp(d[i + 2], lum, 0.15) * 0.96;
  }
}

/** 4. Classic Noir */
function applyNoir(img: ImageData, timeSec: number): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    // Red-weighted black & white monochrome conversion
    const g = 0.45 * d[i] + 0.4 * d[i + 1] + 0.15 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  const contrastCurve = makeToneCurve(0.9, 0.38, 0, 255);
  applyLut1D(img, contrastCurve, contrastCurve, contrastCurve);
  applyFilmGrain(img, 18, timeSec, 77);
  applyVignetteImageData(img, 0.3, 0.95, 0.55);
}

/** 5. Vintage Sepia */
function applySepia(img: ImageData): void {
  applyDuotone(img, [38, 22, 10], [252, 240, 218]);
  applyVignetteImageData(img, 0.35, 1.05, 0.45);
}

/** 6. Cross-Process */
function applyCrossProcess(img: ImageData): void {
  const rLut = makeToneCurve(0.9, 0.28, 8, 255);
  const gLut = makeToneCurve(1.05, 0.18, 0, 248);
  const bLut = makeToneCurve(1.25, 0.32, 28, 220);
  applyLut1D(img, rLut, gLut, bLut);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(d[i] * 1.08);
    d[i + 1] = clamp255(d[i + 1] * 1.04);
  }
}

/** 7. Vaporwave */
function applyVaporwave(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]) / 255;
    // Shadows: deep purple / violet (#2d004b -> #bd00ff)
    // Highlights: cyan / turquoise (#00f0ff)
    if (lum < 0.5) {
      const t = lum * 2;
      d[i] = lerp(45, 189, t);
      d[i + 1] = lerp(0, 40, t);
      d[i + 2] = lerp(85, 255, t);
    } else {
      const t = (lum - 0.5) * 2;
      d[i] = lerp(189, 20, t);
      d[i + 1] = lerp(40, 240, t);
      d[i + 2] = 255;
    }
  }
  applyBloomGlow(img, 175, 5, 0.45);
}

/** 8. Golden Hour */
function applyGoldenHour(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]) / 255;
    const warmBoost = Math.sin(lum * Math.PI) * 26;
    d[i] = clamp255(d[i] * 1.14 + warmBoost + 8);
    d[i + 1] = clamp255(d[i + 1] * 1.06 + warmBoost * 0.6);
    d[i + 2] = clamp255(d[i + 2] * 0.82 - 8);
  }
  applyBloomGlow(img, 190, 4, 0.4);
  applyVignetteImageData(img, 0.4, 1.1, 0.28);
}

/** 9. Cool Blue / Nordic */
function applyCoolBlue(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]);
    // Desaturate slightly, lift cool slate blue
    d[i] = clamp255(lerp(d[i], lum, 0.25) * 0.9 - 6);
    d[i + 1] = clamp255(lerp(d[i + 1], lum, 0.15) * 0.98);
    d[i + 2] = clamp255(lerp(d[i + 2], lum, 0.1) * 1.18 + 18);
  }
  const curve = makeToneCurve(0.96, 0.15, 6, 250);
  applyLut1D(img, curve, curve, curve);
}

/** 10. High-Key */
function applyHighKey(img: ImageData): void {
  const curve = makeToneCurve(0.72, -0.15, 55, 255);
  applyLut1D(img, curve, curve, curve);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]);
    // Soft desaturation for clean minimalism
    d[i] = clamp255(lerp(d[i], lum, 0.28) * 1.04);
    d[i + 1] = clamp255(lerp(d[i + 1], lum, 0.28) * 1.04);
    d[i + 2] = clamp255(lerp(d[i + 2], lum, 0.28) * 1.04);
  }
}

/** 11. Low-Key / Chiaroscuro */
function applyLowKey(img: ImageData): void {
  const curve = makeToneCurve(1.45, 0.32, 0, 245);
  applyLut1D(img, curve, curve, curve);
  applyVignetteImageData(img, 0.22, 0.85, 0.72);
}

/** 12. Instant Polaroid */
function applyPolaroid(img: ImageData): void {
  const rLut = makeToneCurve(0.98, 0.1, 24, 245);
  const gLut = makeToneCurve(1.02, 0.08, 20, 242);
  const bLut = makeToneCurve(1.15, 0.05, 38, 230);
  applyLut1D(img, rLut, gLut, bLut);
  applyVignetteImageData(img, 0.35, 1.05, 0.38);
}

/** 13. Kodachrome 64 */
function applyKodachrome(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    // Vibrant punchy reds and warm ochres with deep contrast
    d[i] = clamp255(r * 1.25 - g * 0.12 - b * 0.05 + 6);
    d[i + 1] = clamp255(g * 1.12 - b * 0.08);
    d[i + 2] = clamp255(b * 0.94);
  }
  const curve = makeToneCurve(0.94, 0.22, 4, 252);
  applyLut1D(img, curve, curve, curve);
  applyVignetteImageData(img, 0.45, 1.1, 0.24);
}

/** 14. Duotone: Sunset */
function applyDuotoneSunset(img: ImageData): void {
  applyDuotone(img, [34, 12, 60], [255, 158, 110]);
}

/** 15. Duotone: Cyber */
function applyDuotoneCyber(img: ImageData): void {
  applyDuotone(img, [12, 16, 48], [0, 255, 162]);
}

/** 16. Duotone: Ruby */
function applyDuotoneRuby(img: ImageData): void {
  applyDuotone(img, [10, 22, 38], [235, 45, 75]);
}

/** 17. Artisan Vignette */
function applyVignettePreset(img: ImageData): void {
  const curve = makeToneCurve(1.0, 0.15, 0, 255);
  applyLut1D(img, curve, curve, curve);
  applyVignetteImageData(img, 0.28, 0.95, 0.7);
}

/** 18. Dreamy Bloom */
function applyDreamyBloom(img: ImageData): void {
  applyBloomGlow(img, 165, 8, 0.75);
}

/** 19. Newspaper Halftone */
function applyHalftone(img: ImageData): void {
  const { width: w, height: h, data: d } = img;
  const dotSpacing = Math.max(4, Math.round(Math.min(w, h) / 75));
  const maxRadius = dotSpacing * 0.55;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = luminance(d[i], d[i + 1], d[i + 2]) / 255;
      const cx = (Math.floor(x / dotSpacing) + 0.5) * dotSpacing;
      const cy = (Math.floor(y / dotSpacing) + 0.5) * dotSpacing;
      const dist = Math.hypot(x - cx, y - cy);
      const dotR = maxRadius * (1 - lum);

      if (dist < dotR) {
        // Ink dot
        d[i] = 22;
        d[i + 1] = 22;
        d[i + 2] = 26;
      } else {
        // Paper background
        d[i] = 246;
        d[i + 1] = 243;
        d[i + 2] = 236;
      }
    }
  }
}

/** 20. 8-Bit Pixelate */
function applyPixelate(img: ImageData): void {
  const { width: w, height: h, data: d } = img;
  const block = Math.max(4, Math.round(Math.min(w, h) / 48));

  for (let by = 0; by < h; by += block) {
    for (let bx = 0; bx < w; bx += block) {
      let r = 0;
      let g = 0;
      let b = 0;
      let n = 0;
      const ye = Math.min(h, by + block);
      const xe = Math.min(w, bx + block);

      for (let y = by; y < ye; y++) {
        for (let x = bx; x < xe; x++) {
          const i = (y * w + x) * 4;
          r += d[i];
          g += d[i + 1];
          b += d[i + 2];
          n++;
        }
      }

      r = Math.round(r / n);
      g = Math.round(g / n);
      b = Math.round(b / n);

      for (let y = by; y < ye; y++) {
        for (let x = bx; x < xe; x++) {
          const i = (y * w + x) * 4;
          d[i] = r;
          d[i + 1] = g;
          d[i + 2] = b;
        }
      }
    }
  }
}

/** 21. Pop Posterize */
function applyPosterize(img: ImageData): void {
  const d = img.data;
  const levels = 4;
  const step = 255 / (levels - 1);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp255(Math.round(d[i] / step) * step);
    d[i + 1] = clamp255(Math.round(d[i + 1] / step) * step);
    d[i + 2] = clamp255(Math.round(d[i + 2] / step) * step);
  }
}

/** 22. Emerald Matrix CRT */
function applyCyberpunkMatrix(img: ImageData, timeSec: number): void {
  const { width: w, height: h, data: d } = img;
  const scanlineOffset = Math.floor(timeSec * 30) % 3;

  for (let y = 0; y < h; y++) {
    const isScanline = (y + scanlineOffset) % 3 === 0;
    const scanDim = isScanline ? 0.65 : 1.0;

    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = luminance(d[i], d[i + 1], d[i + 2]) / 255;
      d[i] = clamp255(lum * 35 * scanDim);
      d[i + 1] = clamp255((lum * 225 + 15) * scanDim);
      d[i + 2] = clamp255(lum * 65 * scanDim);
    }
  }
  applyVignetteImageData(img, 0.35, 1.0, 0.5);
}

/** 23. Bleach Bypass */
function applyBleachBypass(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = luminance(d[i], d[i + 1], d[i + 2]);
    // High contrast blend with heavily desaturated base (silver retention)
    const desatR = lerp(d[i], lum, 0.65);
    const desatG = lerp(d[i + 1], lum, 0.65);
    const desatB = lerp(d[i + 2], lum, 0.65);

    // Overlay blend mode simulation
    const blendChannel = (base: number, blend: number) =>
      blend < 128
        ? (2 * base * blend) / 255
        : 255 - (2 * (255 - base) * (255 - blend)) / 255;

    d[i] = clamp255(blendChannel(desatR, lum));
    d[i + 1] = clamp255(blendChannel(desatG, lum));
    d[i + 2] = clamp255(blendChannel(desatB, lum));
  }
}

/** 24. Wood-Effect Infrared */
function applyInfrared(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    // In infrared photography, green foliage and vegetation reflect massive IR
    const irIntensity = Math.min(255, (g * 1.6 + r * 0.9) - b * 0.5);
    d[i] = clamp255(irIntensity * 0.96 + 10);
    d[i + 1] = clamp255(irIntensity * 0.98 + 8);
    d[i + 2] = clamp255(irIntensity * 1.05 + 15);
  }
  applyBloomGlow(img, 180, 5, 0.55);
  applyVignetteImageData(img, 0.4, 1.05, 0.4);
}

/** 25. Solarize / Sabattier */
function applySolarize(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const v = d[i + c];
      d[i + c] = v > 127 ? 255 - v : v * 1.6;
    }
  }
  applyVignetteImageData(img, 0.4, 1.1, 0.3);
}

/** 26. Warm 70s Vintage */
function applyWarmVintage(img: ImageData, timeSec: number): void {
  const rLut = makeToneCurve(0.92, 0.1, 20, 255);
  const gLut = makeToneCurve(1.0, 0.08, 12, 245);
  const bLut = makeToneCurve(1.18, 0.04, 25, 218);
  applyLut1D(img, rLut, gLut, bLut);
  applyFilmGrain(img, 16, timeSec, 55);
  applyVignetteImageData(img, 0.35, 1.1, 0.32);
}

// ---------------------------------------------------------------------------
// Preset Registry
// ---------------------------------------------------------------------------

export const PHOTO_FILTERS: readonly PhotoFilterDef[] = [
  {
    id: "cinematic-teal-orange",
    label: "Teal & Orange",
    category: "cinematic",
    emoji: "🎬",
    description: "Iconic blockbuster look with warm bronze skin tones and deep teal shadows.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyTealOrange(img)),
  },
  {
    id: "film-grain",
    label: "35mm Film Grain",
    category: "vintage",
    emoji: "🎞️",
    description: "Authentic analog silver-halide grain texture with lifted soft blacks.",
    animated: true,
    apply: (img, t = 0, intensity) =>
      withIntensity(img, intensity, () => applyFilmGrainFilter(img, t)),
  },
  {
    id: "faded-matte",
    label: "Faded Matte",
    category: "vintage",
    emoji: "🌫️",
    description: "Milky lifted shadows, compressed dynamic range, and soft pastel tones.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyFadedMatte(img)),
  },
  {
    id: "noir",
    label: "Classic Noir",
    category: "monochrome",
    emoji: "🕵️",
    description: "High-contrast black & white with dramatic tonal separation and fine grain.",
    animated: true,
    apply: (img, t = 0, intensity) =>
      withIntensity(img, intensity, () => applyNoir(img, t)),
  },
  {
    id: "sepia",
    label: "Vintage Sepia",
    category: "vintage",
    emoji: "📜",
    description: "Authentic 1890s golden-brown albumen print with corner vignette.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applySepia(img)),
  },
  {
    id: "cross-process",
    label: "Cross-Process",
    category: "artistic",
    emoji: "🧪",
    description: "Vibrant chemical color shift with punchy greens and electric blue shadows.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyCrossProcess(img)),
  },
  {
    id: "vaporwave",
    label: "Vaporwave",
    category: "artistic",
    emoji: "🌴",
    description: "Nostalgic 80s synthwave neon purple shadows and turquoise highlights.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyVaporwave(img)),
  },
  {
    id: "golden-hour",
    label: "Golden Hour",
    category: "cinematic",
    emoji: "🌅",
    description: "Radiant sunset amber warmth with softened contrast and glowing highlights.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyGoldenHour(img)),
  },
  {
    id: "cool-blue",
    label: "Cool Nordic",
    category: "cinematic",
    emoji: "❄️",
    description: "Crisp arctic slate tones, desaturated warm channels, and clean blues.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyCoolBlue(img)),
  },
  {
    id: "high-key",
    label: "High-Key",
    category: "mood",
    emoji: "🕊️",
    description: "Airy, luminous fashion aesthetic with lifted shadows and soft light.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyHighKey(img)),
  },
  {
    id: "low-key",
    label: "Low-Key",
    category: "mood",
    emoji: "🌑",
    description: "Velvety shadows and deep moody chiaroscuro with preserved highlights.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyLowKey(img)),
  },
  {
    id: "polaroid",
    label: "Instant Polaroid",
    category: "vintage",
    emoji: "📷",
    description: "1970s instant snapshot with olive-tinted darks and creamy highlights.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyPolaroid(img)),
  },
  {
    id: "kodachrome",
    label: "Kodachrome 64",
    category: "vintage",
    emoji: "🌻",
    description: "Legendary magazine color film with saturated warm reds and bold contrast.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyKodachrome(img)),
  },
  {
    id: "duotone-sunset",
    label: "Duotone Sunset",
    category: "duotone",
    emoji: "🌆",
    description: "Two-tone gradient map from deep plum purple to radiant peach coral.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyDuotoneSunset(img)),
  },
  {
    id: "duotone-cyber",
    label: "Duotone Cyber",
    category: "duotone",
    emoji: "⚡",
    description: "High-contrast two-tone gradient from dark navy to fluorescent lime.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyDuotoneCyber(img)),
  },
  {
    id: "duotone-ruby",
    label: "Duotone Ruby",
    category: "duotone",
    emoji: "💎",
    description: "Dramatic two-tone gradient from midnight sapphire to vivid crimson ruby.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyDuotoneRuby(img)),
  },
  {
    id: "vignette",
    label: "Artisan Vignette",
    category: "mood",
    emoji: "🎯",
    description: "Smooth optical lens edge darkening directing focus to the subject.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyVignettePreset(img)),
  },
  {
    id: "bloom-glow",
    label: "Dreamy Bloom",
    category: "mood",
    emoji: "✨",
    description: "Ethereal highlight diffusion bleeding soft luminous radiance into shadows.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyDreamyBloom(img)),
  },
  {
    id: "halftone",
    label: "Newsprint Halftone",
    category: "artistic",
    emoji: "🗞️",
    description: "Geometric dot matrix screen print inspired by vintage newsprint.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyHalftone(img)),
  },
  {
    id: "pixelate",
    label: "8-Bit Pixelate",
    category: "artistic",
    emoji: "👾",
    description: "Chunky retro pixel mosaic blocks for classic arcade aesthetic.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyPixelate(img)),
  },
  {
    id: "posterize",
    label: "Pop Posterize",
    category: "artistic",
    emoji: "🎨",
    description: "Quantized color bands inspired by Andy Warhol pop art prints.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyPosterize(img)),
  },
  {
    id: "cyberpunk-matrix",
    label: "Emerald Matrix",
    category: "artistic",
    emoji: "💻",
    description: "CRT phosphor green terminal glow with subtle animated scanlines.",
    animated: true,
    apply: (img, t = 0, intensity) =>
      withIntensity(img, intensity, () => applyCyberpunkMatrix(img, t)),
  },
  {
    id: "bleach-bypass",
    label: "Bleach Bypass",
    category: "cinematic",
    emoji: "⚔️",
    description: "Gritty silver-retention film look with stark contrast and desaturated hues.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyBleachBypass(img)),
  },
  {
    id: "infrared",
    label: "Infrared Wood Effect",
    category: "artistic",
    emoji: "🌿",
    description: "Surreal near-IR landscape emulation turning vegetation into luminous white.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applyInfrared(img)),
  },
  {
    id: "solarize",
    label: "Sabattier Solarize",
    category: "artistic",
    emoji: "🪞",
    description: "Surreal partial tone curve reversal producing metallic silver borders.",
    animated: false,
    apply: (img, _t, intensity) =>
      withIntensity(img, intensity, () => applySolarize(img)),
  },
  {
    id: "warm-vintage",
    label: "Warm 70s Album",
    category: "vintage",
    emoji: "📻",
    description: "Cozy warm highlights, faded cyan-greens, and fine grain from 1970s albums.",
    animated: true,
    apply: (img, t = 0, intensity) =>
      withIntensity(img, intensity, () => applyWarmVintage(img, t)),
  },
];

const PHOTO_FILTER_MAP = new Map(PHOTO_FILTERS.map((f) => [f.id, f]));

export function isPhotoFilter(id: string): boolean {
  return PHOTO_FILTER_MAP.has(id);
}

export function getPhotoFilter(id: string): PhotoFilterDef | undefined {
  return PHOTO_FILTER_MAP.get(id);
}

/**
 * Apply a photo filter preset in place.
 * Returns false if the preset id is not recognized.
 */
export function applyPhotoFilter(
  img: ImageData,
  id: string,
  opts: PhotoFilterOptions = {},
): boolean {
  const def = PHOTO_FILTER_MAP.get(id);
  if (!def) return false;
  def.apply(img, opts.timeSec ?? 0, opts.intensity ?? 1);
  return true;
}
