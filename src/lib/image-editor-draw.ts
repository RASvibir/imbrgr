export const DRAW_COLOR_STORAGE_KEY = "imbrgr.editor.drawColor";

export const DRAW_COLOR_SWATCHES = [
  { id: "ember", label: "Ember", color: "#ff6b2c" },
  { id: "flame", label: "Flame", color: "#ff3d00" },
  { id: "cream", label: "Cream", color: "#fff5e6" },
  { id: "coal", label: "Coal", color: "#1a1a1a" },
  { id: "snow", label: "Snow", color: "#ffffff" },
  { id: "sky", label: "Sky", color: "#4fc3f7" },
  { id: "leaf", label: "Leaf", color: "#66bb6a" },
  { id: "grape", label: "Grape", color: "#ab47bc" },
] as const;

export function readStoredDrawColor(): string {
  if (typeof window === "undefined") return DRAW_COLOR_SWATCHES[0].color;
  try {
    const v = localStorage.getItem(DRAW_COLOR_STORAGE_KEY);
    if (v && /^#[0-9a-fA-F]{6}$/.test(v)) return v;
  } catch {
    /* ignore */
  }
  return DRAW_COLOR_SWATCHES[0].color;
}

export function storeDrawColor(color: string): void {
  try {
    localStorage.setItem(DRAW_COLOR_STORAGE_KEY, color);
  } catch {
    /* ignore */
  }
}

export function drawCanvasHasInk(canvas: HTMLCanvasElement | null): boolean {
  if (!canvas) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] > 0) return true;
  }
  return false;
}

export function snapshotDrawCanvas(canvas: HTMLCanvasElement | null): string | null {
  if (!canvas || !drawCanvasHasInk(canvas)) return null;
  return canvas.toDataURL("image/png");
}

export function restoreDrawCanvas(canvas: HTMLCanvasElement | null, dataUrl: string | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!dataUrl) return;
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };
  img.src = dataUrl;
}
