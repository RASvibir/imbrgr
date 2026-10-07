export type SpotFix = { nx: number; ny: number };

export type ImageEditState = {
  filter: string;
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  warmth: number;
  rotation: number;
  flipH: boolean;
  vignette: number;
  sharpen: number;
  smooth: number;
  spotFixes: SpotFix[];
};

export type CropArea = { x: number; y: number; width: number; height: number };

export const DEFAULT_IMAGE_EDIT_STATE: ImageEditState = {
  filter: "none",
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 100,
  warmth: 100,
  rotation: 0,
  flipH: false,
  vignette: 0,
  sharpen: 0,
  smooth: 0,
  spotFixes: [],
};

export const AUTO_ENHANCE_EDIT: Partial<ImageEditState> = {
  brightness: 108,
  contrast: 112,
  saturation: 112,
  exposure: 102,
  warmth: 106,
};

export type SliderKey = "brightness" | "contrast" | "saturation" | "exposure" | "warmth";

export const SLIDER_DEFAULTS: Record<SliderKey, number> = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 100,
  warmth: 100,
};

/** Pixel filters applied after draw (export + live preview). */
export function applyPixelFilter(imageData: ImageData, filter: string): void {
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (filter === "mono") {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      d[i] = d[i + 1] = d[i + 2] = g;
    } else if (filter === "ember") {
      d[i] = Math.min(255, d[i] * 1.1 + 20);
      d[i + 1] *= 0.92;
      d[i + 2] *= 0.85;
    } else if (filter === "vivid") {
      d[i] = Math.min(255, d[i] * 1.15);
      d[i + 1] = Math.min(255, d[i + 1] * 1.1);
      d[i + 2] = Math.min(255, d[i + 2] * 1.1);
    }
  }
}

export function applyWarmth(imageData: ImageData, warmth: number): void {
  if (warmth === 100) return;
  const t = warmth / 100;
  const d = imageData.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.min(255, d[i] * t);
    d[i + 2] = Math.min(255, d[i + 2] / t);
  }
}

export function applySharpen(imageData: ImageData, amount: number): void {
  if (amount <= 0) return;
  const w = imageData.width;
  const h = imageData.height;
  const src = new Uint8ClampedArray(imageData.data);
  const d = imageData.data;
  const strength = amount / 100;
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * w + (x + kx)) * 4 + c;
            sum += src[idx] * kernel[ki];
            ki++;
          }
        }
        const out = src[(y * w + x) * 4 + c] + sum * strength * 0.25;
        d[(y * w + x) * 4 + c] = Math.min(255, Math.max(0, out));
      }
    }
  }
}

export function applySpotHeal(imageData: ImageData, cx: number, cy: number, radius = 10): void {
  const w = imageData.width;
  const h = imageData.height;
  const d = imageData.data;
  const px = Math.round(cx * (w - 1));
  const py = Math.round(cy * (h - 1));
  const r = Math.max(3, radius);
  let ar = 0;
  let ag = 0;
  let ab = 0;
  let n = 0;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const dist = Math.hypot(dx, dy);
      if (dist < r * 0.45 || dist > r) continue;
      const x = px + dx;
      const y = py + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      ar += d[i];
      ag += d[i + 1];
      ab += d[i + 2];
      n++;
    }
  }
  if (!n) return;
  ar /= n;
  ag /= n;
  ab /= n;
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (Math.hypot(dx, dy) > r) continue;
      const x = px + dx;
      const y = py + dy;
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = (y * w + x) * 4;
      d[i] = ar;
      d[i + 1] = ag;
      d[i + 2] = ab;
    }
  }
}

export function applySpotFixes(imageData: ImageData, fixes: SpotFix[]): void {
  for (const f of fixes) {
    applySpotHeal(imageData, f.nx, f.ny);
  }
}

export function applyVignette(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number): void {
  if (amount <= 0) return;
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.2, w / 2, h / 2, Math.max(w, h) * 0.72);
  const a = Math.min(0.65, (amount / 100) * 0.65);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function editStatesEqual(a: ImageEditState, b: ImageEditState): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export async function loadImageBitmapFromUrl(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  const blob = await res.blob();
  return createImageBitmap(blob);
}

function applyGlobalSmooth(ctx: CanvasRenderingContext2D, w: number, h: number, amount: number): void {
  if (amount <= 0) return;
  const blurPx = (amount / 100) * 6;
  const copy = document.createElement("canvas");
  copy.width = w;
  copy.height = h;
  const cctx = copy.getContext("2d");
  if (!cctx) return;
  cctx.filter = `blur(${blurPx}px)`;
  cctx.drawImage(ctx.canvas, 0, 0);
  ctx.filter = "none";
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(copy, 0, 0);
}

export async function renderEditedImageCanvas(
  image: ImageBitmap,
  area: CropArea,
  state: ImageEditState,
  targetWidth?: number,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  const targetW = targetWidth ? Math.min(4096, Math.max(64, targetWidth)) : area.width;
  const scale = targetWidth ? targetW / area.width : 1;
  canvas.width = Math.max(1, Math.round(area.width * scale));
  canvas.height = Math.max(1, Math.round(area.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const exp = state.exposure / 100;
  ctx.filter = `brightness(${state.brightness * exp}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((state.rotation * Math.PI) / 180);
  ctx.scale(state.flipH ? -1 : 1, 1);
  ctx.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    -canvas.width / 2,
    -canvas.height / 2,
    canvas.width,
    canvas.height,
  );
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  let pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  if (state.filter !== "none") {
    applyPixelFilter(pixels, state.filter);
  }
  applyWarmth(pixels, state.warmth);
  if (state.spotFixes.length) {
    applySpotFixes(pixels, state.spotFixes);
  }
  if (state.sharpen > 0) {
    applySharpen(pixels, state.sharpen);
  }
  ctx.putImageData(pixels, 0, 0);

  applyGlobalSmooth(ctx, canvas.width, canvas.height, state.smooth);
  applyVignette(ctx, canvas.width, canvas.height, state.vignette);

  return canvas;
}

export async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("export failed"))), "image/jpeg", quality);
  });
}

/** Sample mean red channel from ImageData (for tests). */
export function meanRedChannel(imageData: ImageData): number {
  const d = imageData.data;
  let sum = 0;
  let n = 0;
  for (let i = 0; i < d.length; i += 4) {
    sum += d[i];
    n++;
  }
  return n ? sum / n : 0;
}

export function normalizeEditState(raw: Partial<ImageEditState> | ImageEditState): ImageEditState {
  return {
    ...DEFAULT_IMAGE_EDIT_STATE,
    ...raw,
    spotFixes: raw.spotFixes ? [...raw.spotFixes] : [],
  };
}
