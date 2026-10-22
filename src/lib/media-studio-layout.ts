export type MediaStudioLayout = "side-by-side" | "stacked" | "grid" | "overlay" | "pip" | "collage";

export type FrameRect = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
};

function clampPositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

export function computeFrameRects(params: {
  layout: MediaStudioLayout;
  count: number;
  canvasWidth: number;
  canvasHeight: number;
  spacing: number;
  rows?: number;
  columns?: number;
}): FrameRect[] {
  const count = Math.max(0, Math.floor(params.count));
  const width = Math.max(1, Math.floor(params.canvasWidth));
  const height = Math.max(1, Math.floor(params.canvasHeight));
  const spacing = Math.max(0, Math.floor(params.spacing));
  if (count === 0) return [];

  if (params.layout === "overlay") {
    return Array.from({ length: count }, (_, i) => ({ x: 0, y: 0, width, height, zIndex: i }));
  }

  if (params.layout === "pip") {
    const rects: FrameRect[] = [{ x: 0, y: 0, width, height, zIndex: 0 }];
    const pipWidth = Math.max(80, Math.floor(width * 0.32));
    const pipHeight = Math.max(60, Math.floor(height * 0.32));
    for (let i = 1; i < count; i++) {
      const col = (i - 1) % 2;
      const row = Math.floor((i - 1) / 2);
      const x = width - pipWidth - spacing - col * (pipWidth + spacing);
      const y = height - pipHeight - spacing - row * (pipHeight + spacing);
      rects.push({ x: Math.max(0, x), y: Math.max(0, y), width: pipWidth, height: pipHeight, zIndex: i + 1 });
    }
    return rects;
  }

  let rows = 1;
  let columns = count;
  if (params.layout === "stacked") {
    rows = count;
    columns = 1;
  } else if (params.layout === "grid" || params.layout === "collage") {
    rows = clampPositiveInt(params.rows ?? Math.ceil(Math.sqrt(count)), 1);
    columns = clampPositiveInt(params.columns ?? Math.ceil(count / rows), 1);
    while (rows * columns < count) columns += 1;
  }

  const cellWidth = Math.max(1, Math.floor((width - spacing * (columns - 1)) / columns));
  const cellHeight = Math.max(1, Math.floor((height - spacing * (rows - 1)) / rows));

  return Array.from({ length: count }, (_, i) => {
    const col = i % columns;
    const row = Math.floor(i / columns);
    return {
      x: col * (cellWidth + spacing),
      y: row * (cellHeight + spacing),
      width: cellWidth,
      height: cellHeight,
      zIndex: i,
    };
  });
}

export function normalizeClipRange(durationSec: number, startSec: number, endSec: number): {
  startSec: number;
  endSec: number;
  durationSec: number;
} {
  const duration = Number.isFinite(durationSec) && durationSec > 0 ? durationSec : 1;
  const start = Math.max(0, Math.min(duration, Number.isFinite(startSec) ? startSec : 0));
  const endRaw = Number.isFinite(endSec) ? endSec : duration;
  const end = Math.max(start + 0.05, Math.min(duration, endRaw));
  return { startSec: start, endSec: end, durationSec: Math.max(0.05, end - start) };
}
