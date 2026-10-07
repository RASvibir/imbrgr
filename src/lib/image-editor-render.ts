export type ImageEditState = {
  filter: string;
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  rotation: number;
  flipH: boolean;
};

export type CropArea = { x: number; y: number; width: number; height: number };

export const DEFAULT_IMAGE_EDIT_STATE: ImageEditState = {
  filter: "none",
  brightness: 100,
  contrast: 100,
  saturation: 100,
  exposure: 100,
  rotation: 0,
  flipH: false,
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

export function editStatesEqual(a: ImageEditState, b: ImageEditState): boolean {
  return (
    a.filter === b.filter &&
    a.brightness === b.brightness &&
    a.contrast === b.contrast &&
    a.saturation === b.saturation &&
    a.exposure === b.exposure &&
    a.rotation === b.rotation &&
    a.flipH === b.flipH
  );
}

export async function loadImageBitmapFromUrl(url: string): Promise<ImageBitmap> {
  const res = await fetch(url);
  const blob = await res.blob();
  return createImageBitmap(blob);
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

  if (state.filter !== "none") {
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
    applyPixelFilter(pixels, state.filter);
    ctx.putImageData(pixels, 0, 0);
  }

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
