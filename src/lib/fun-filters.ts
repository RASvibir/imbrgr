/**
 * imbrgr Fun Filters — our own silly, burger-flavored content augmentations.
 *
 * Pure ImageData transforms shared by the image editor (static, timeSec = 0)
 * and the pacNcap video pipeline (animated per frame via timeSec).
 * Deterministic: no Math.random, so exports and tests are repeatable.
 */

export type FunFilterOptions = {
  /** Timeline seconds; animates shimmer / wobble / drift filters. Images use 0. */
  timeSec?: number;
  /** 0–1 blend of the filter over the original pixels (default 1). */
  intensity?: number;
};

export type FunFilterDef = {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** True when the look changes over time (video). */
  animated: boolean;
  apply: (img: ImageData, timeSec: number) => void;
};

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Small integer hash -> [0, 1). */
function hash2(x: number, y: number, seed = 0): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Resample pixels from an offset position (edge-clamped). Alpha is left untouched. */
function displace(img: ImageData, fn: (x: number, y: number, o: { dx: number; dy: number }) => void): void {
  const { width: w, height: h, data: d } = img;
  const src = d.slice();
  const o = { dx: 0, dy: 0 };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      o.dx = 0;
      o.dy = 0;
      fn(x, y, o);
      const sx = Math.min(w - 1, Math.max(0, Math.round(x + o.dx)));
      const sy = Math.min(h - 1, Math.max(0, Math.round(y + o.dy)));
      const si = (sy * w + sx) * 4;
      const di = (y * w + x) * 4;
      d[di] = src[si];
      d[di + 1] = src[si + 1];
      d[di + 2] = src[si + 2];
    }
  }
}

/** Dark -> ketchup red -> mustard yellow gradient map. */
function ketchupMustard(img: ImageData): void {
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const t = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
    if (t < 0.5) {
      const k = t * 2;
      d[i] = lerp(60, 214, k);
      d[i + 1] = lerp(8, 32, k);
      d[i + 2] = lerp(12, 30, k);
    } else {
      const k = (t - 0.5) * 2;
      d[i] = lerp(214, 255, k);
      d[i + 1] = lerp(32, 207, k);
      d[i + 2] = lerp(30, 48, k);
    }
  }
}

/** Everything slumps downward in gooey drips and turns cheddar. */
function cheeseMelt(img: ImageData, t: number): void {
  const { width: w, height: h } = img;
  displace(img, (x, y, o) => {
    const drip = 0.5 + 0.5 * Math.sin(x * 0.05 + t * 1.6);
    const lump = 0.5 + 0.5 * Math.sin(x * 0.011 + 1.3);
    o.dy = -drip * lump * h * 0.07 * (0.25 + 0.75 * (y / h));
  });
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = d[i] * 1.05 + 12;
    d[i + 1] = d[i + 1] * 1.02 + 8;
    d[i + 2] = d[i + 2] * 0.72;
  }
  void w;
}

/** Heat-haze shimmer with an orange grill glow rising from the bottom. */
function flameGrilled(img: ImageData, t: number): void {
  const { width: w, height: h, data: d } = img;
  displace(img, (_x, y, o) => {
    o.dx = Math.sin(y * 0.06 + t * 6) * w * 0.006 * (0.4 + y / h);
  });
  for (let y = 0; y < h; y++) {
    const glow = (y / h) * (y / h);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      d[i] = d[i] * 1.06 + 90 * glow;
      d[i + 1] = d[i + 1] + 35 * glow;
      d[i + 2] = d[i + 2] * (1 - 0.35 * glow);
    }
  }
}

/** Crunchy, oversaturated, posterized, noisy — "fried" meme energy. */
function deepFried(img: ImageData): void {
  const { width: w, data: d } = img;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    const x = p % w;
    const y = (p / w) | 0;
    const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const noise = (hash2(x, y, 7) - 0.5) * 36;
    for (let c = 0; c < 3; c++) {
      let v = lum + (d[i + c] - lum) * 1.8;
      v = (v - 128) * 1.6 + 128 + noise;
      v = Math.round((Math.max(0, Math.min(255, v)) / 255) * 5) * (255 / 5);
      d[i + c] = v;
    }
    d[i] *= 1.08;
    d[i + 2] *= 0.8;
  }
}

/** Chunky mosaic blocks with a limited color palette. */
function pixelPatty(img: ImageData): void {
  const { width: w, height: h, data: d } = img;
  const block = Math.max(4, Math.round(Math.min(w, h) / 48));
  const step = 255 / 4;
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
      r = Math.round(r / n / step) * step;
      g = Math.round(g / n / step) * step;
      b = Math.round(b / n / step) * step;
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

/** Night-vision-in-a-jar: green phosphor with scanlines. */
function pickleVision(img: ImageData): void {
  const { width: w, height: h, data: d } = img;
  for (let y = 0; y < h; y++) {
    const scan = y % 3 === 0 ? 0.72 : 1;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = lum * 0.35 * scan;
      d[i + 1] = (lum * 1.05 + 10) * scan;
      d[i + 2] = lum * 0.4 * scan;
    }
  }
}

/** Everything jiggles like a gelatin dessert. */
function jellyWobble(img: ImageData, t: number): void {
  const { width: w, height: h } = img;
  displace(img, (x, y, o) => {
    o.dx = Math.sin(y * 0.03 + t * 4) * w * 0.012;
    o.dy = Math.cos(x * 0.03 + t * 3.3) * h * 0.012;
  });
}

/** Sesame seeds rain down over the picture. */
function sesameStorm(img: ImageData, t: number): void {
  const { width: w, height: h, data: d } = img;
  const cell = Math.max(6, Math.round(Math.min(w, h) / 40));
  const fall = t * cell * 3;
  for (let y = 0; y < h; y++) {
    const cy = Math.floor((y - fall) / cell);
    for (let x = 0; x < w; x++) {
      const cx = Math.floor(x / cell);
      if (hash2(cx, cy, 3) > 0.14) continue;
      const px = (cx + 0.2 + 0.6 * hash2(cx, cy, 4)) * cell;
      const py = (cy + 0.2 + 0.6 * hash2(cx, cy, 5)) * cell + fall;
      const ex = (x - px) / (cell * 0.34);
      const ey = (y - py) / (cell * 0.18);
      const dist = ex * ex + ey * ey;
      if (dist >= 1) continue;
      const i = (y * w + x) * 4;
      const shade = 0.82 + 0.18 * (1 - dist);
      const a = 0.92;
      d[i] = lerp(d[i], 245 * shade, a);
      d[i + 1] = lerp(d[i + 1], 228 * shade, a);
      d[i + 2] = lerp(d[i + 2], 188 * shade, a);
    }
  }
}

export const FUN_FILTERS: readonly FunFilterDef[] = [
  {
    id: "ketchup-mustard",
    label: "Ketchup & Mustard",
    emoji: "🍅",
    description: "Duotone gradient map from ketchup red to mustard yellow.",
    animated: false,
    apply: (img) => ketchupMustard(img),
  },
  {
    id: "cheese-melt",
    label: "Cheese Melt",
    emoji: "🧀",
    description: "Cheddar tint with gooey downward drips.",
    animated: true,
    apply: cheeseMelt,
  },
  {
    id: "flame-grilled",
    label: "Flame-Grilled",
    emoji: "🔥",
    description: "Heat-haze shimmer and a grill glow rising from below.",
    animated: true,
    apply: flameGrilled,
  },
  {
    id: "deep-fried",
    label: "Deep Fried",
    emoji: "🍟",
    description: "Crunchy oversaturated posterized noise.",
    animated: false,
    apply: (img) => deepFried(img),
  },
  {
    id: "pixel-patty",
    label: "Pixel Patty",
    emoji: "🍔",
    description: "Chunky mosaic blocks with a tiny palette.",
    animated: false,
    apply: (img) => pixelPatty(img),
  },
  {
    id: "pickle-vision",
    label: "Pickle Vision",
    emoji: "🥒",
    description: "Green phosphor night-vision with scanlines.",
    animated: false,
    apply: (img) => pickleVision(img),
  },
  {
    id: "jelly-wobble",
    label: "Jelly Wobble",
    emoji: "🍮",
    description: "Everything jiggles like gelatin.",
    animated: true,
    apply: jellyWobble,
  },
  {
    id: "sesame-storm",
    label: "Sesame Storm",
    emoji: "🌾",
    description: "Sesame seeds rain over the picture.",
    animated: true,
    apply: sesameStorm,
  },
];

const FUN_FILTER_MAP = new Map(FUN_FILTERS.map((f) => [f.id, f]));

export function isFunFilter(id: string): boolean {
  return FUN_FILTER_MAP.has(id);
}

/** Apply a fun filter in place. Returns false when the id is not a fun filter. */
export function applyFunFilter(img: ImageData, id: string, opts: FunFilterOptions = {}): boolean {
  const def = FUN_FILTER_MAP.get(id);
  if (!def) return false;
  const intensity = clamp01(opts.intensity ?? 1);
  if (intensity <= 0) return true;
  const t = opts.timeSec ?? 0;
  if (intensity >= 1) {
    def.apply(img, t);
    return true;
  }
  const orig = img.data.slice();
  def.apply(img, t);
  const d = img.data;
  for (let i = 0; i < d.length; i++) {
    if (i % 4 === 3) continue;
    d[i] = orig[i] + (d[i] - orig[i]) * intensity;
  }
  return true;
}
