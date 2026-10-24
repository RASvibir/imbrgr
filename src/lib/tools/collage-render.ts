/**
 * Pure collage rendering engine: draws layouts, cells, transforms,
 * background styles (solid, gradient, blurred photo), borders, and filters.
 */

import {
  type ComputedCellRect,
  type NormalizedCell,
  computeCellRects,
  calculateCollageDimensions,
  type CollageAspect,
  getTemplateById,
} from "./collage-layouts";
import { applyFunFilter, isFunFilter } from "../fun-filters";

export interface CellMedia {
  url: string;
  type: "image" | "video" | "gif";
  naturalWidth: number;
  naturalHeight: number;
  /** Cached or loaded HTMLImageElement / HTMLVideoElement */
  element?: CanvasImageSource;
}

export interface CellTransform {
  pan: { x: number; y: number }; // -1 to 1 normalized offset
  zoom: number; // 1 to 3 scale
  rotation: number; // 0, 90, 180, 270 degrees
  flipH: boolean;
  flipV: boolean;
  filterId?: string;
  filterIntensity?: number; // 0 to 1
}

export interface CollageCellState {
  id: string;
  media?: CellMedia;
  transform: CellTransform;
  customRect?: NormalizedCell; // For free-form mode
}

export type CollageBackground =
  | { type: "solid"; color: string }
  | { type: "gradient"; presetId: string; stops: [string, string]; angle?: number }
  | { type: "blur"; sourceCellId?: string };

export interface CollageState {
  layoutId: string;
  aspectRatio: CollageAspect;
  customWidth: number;
  customHeight: number;
  padding: number;
  gap: number;
  cornerRadius: number;
  borderWidth: number;
  borderColor: string;
  background: CollageBackground;
  cells: CollageCellState[];
  animate: boolean;
}

export const BACKGROUND_GRADIENT_PRESETS: {
  id: string;
  name: string;
  stops: [string, string];
  angle: number;
}[] = [
  { id: "ember", name: "Ember Flame", stops: ["#ea580c", "#fbbf24"], angle: 135 },
  { id: "charcoal", name: "Charcoal Dark", stops: ["#1c1412", "#0f0d0c"], angle: 135 },
  { id: "sunset", name: "Sunset Horizon", stops: ["#db2777", "#f97316"], angle: 120 },
  { id: "neon", name: "Cyber Neon", stops: ["#4f46e5", "#ec4899"], angle: 140 },
  { id: "pastel", name: "Warm Vanilla", stops: ["#f5ebe3", "#e0d3c5"], angle: 180 },
  { id: "mint", name: "Cool Mint", stops: ["#0f766e", "#14b8a6"], angle: 135 },
];

export const PHOTO_FILTERS: { id: string; label: string; css: string }[] = [
  { id: "none", label: "Original", css: "none" },
  { id: "vivid", label: "Vivid", css: "saturate(1.4) contrast(1.1)" },
  { id: "warm", label: "Warm Sunset", css: "sepia(0.25) saturate(1.2) hue-rotate(-10deg)" },
  { id: "cool", label: "Cool Breeze", css: "saturate(0.9) hue-rotate(15deg) brightness(1.05)" },
  { id: "vintage", label: "Vintage 70s", css: "sepia(0.5) contrast(0.9) brightness(0.95)" },
  { id: "grayscale", label: "B&W Mono", css: "grayscale(1) contrast(1.1)" },
  { id: "noir", label: "Dramatic Noir", css: "grayscale(1) contrast(1.6) brightness(0.9)" },
  { id: "invert", label: "Negative", css: "invert(1)" },
];

export function createDefaultCellTransform(): CellTransform {
  return {
    pan: { x: 0, y: 0 },
    zoom: 1,
    rotation: 0,
    flipH: false,
    flipV: false,
    filterId: "none",
    filterIntensity: 1,
  };
}

export function createInitialCollageState(layoutId = "grid-2x2"): CollageState {
  const template = getTemplateById(layoutId);
  return {
    layoutId,
    aspectRatio: "1:1",
    customWidth: 1080,
    customHeight: 1080,
    padding: 16,
    gap: 12,
    cornerRadius: 12,
    borderWidth: 0,
    borderColor: "#ffffff",
    background: { type: "solid", color: "#141210" },
    cells: template.cells.map((c) => ({
      id: c.id,
      transform: createDefaultCellTransform(),
    })),
    animate: false,
  };
}

/**
 * Draws rounded rectangle path helper.
 */
export function addRoundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2));
  if (radius <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.arcTo(x + w, y, x + w, y + radius, radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius);
  ctx.lineTo(x + radius, y + h);
  ctx.arcTo(x, y + h, x, y + h - radius, radius);
  ctx.lineTo(x, y + radius);
  ctx.arcTo(x, y, x + radius, y, radius);
  ctx.closePath();
}

/**
 * Renders the entire collage to any 2D canvas context.
 */
export async function renderCollage(
  canvas: HTMLCanvasElement,
  state: CollageState,
  options: {
    timeSec?: number;
    scale?: number;
    imageMap?: Map<string, CanvasImageSource>;
  } = {},
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const { width: targetW, height: targetH } = calculateCollageDimensions(
    state.aspectRatio,
    state.customWidth,
    state.customHeight,
    1200,
  );

  const scale = options.scale ?? 1;
  const canvasW = Math.round(targetW * scale);
  const canvasH = Math.round(targetH * scale);

  if (canvas.width !== canvasW || canvas.height !== canvasH) {
    canvas.width = canvasW;
    canvas.height = canvasH;
  }

  const timeSec = options.timeSec ?? 0;
  const padding = Math.round(state.padding * scale);
  const gap = Math.round(state.gap * scale);
  const cornerRadius = Math.round(state.cornerRadius * scale);
  const borderWidth = Math.round(state.borderWidth * scale);

  // 1. Draw Background
  drawCollageBackground(ctx, state.background, canvasW, canvasH, state.cells, options.imageMap);

  // 2. Compute Layout Rects
  const template = getTemplateById(state.layoutId);
  const normalizedCells =
    state.layoutId === "freeform"
      ? state.cells.map(
          (c, i) =>
            c.customRect ??
            template.cells[i] ?? {
              id: c.id,
              x: 0.1 * i,
              y: 0.1 * i,
              width: 0.45,
              height: 0.45,
            },
        )
      : template.cells;

  const cellRects = computeCellRects(normalizedCells, {
    collageWidth: canvasW,
    collageHeight: canvasH,
    padding,
    gap,
    cornerRadius,
  });

  // Sort by zIndex
  const sortedRects = [...cellRects].sort((a, b) => a.zIndex - b.zIndex);

  // 3. Render each cell
  for (const rect of sortedRects) {
    const cellState = state.cells.find((c) => c.id === rect.id);
    const mediaSource = cellState?.media?.url
      ? options.imageMap?.get(cellState.media.url) || cellState.media.element
      : undefined;

    drawCell(ctx, rect, cellState?.transform, mediaSource, timeSec);
  }

  // 4. Draw outer border if present
  if (borderWidth > 0) {
    ctx.strokeStyle = state.borderColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(borderWidth / 2, borderWidth / 2, canvasW - borderWidth, canvasH - borderWidth);
  }
}

/**
 * Draws background fill: solid color, linear gradient, or blurred photo.
 */
function drawCollageBackground(
  ctx: CanvasRenderingContext2D,
  bg: CollageBackground,
  width: number,
  height: number,
  cells: CollageCellState[],
  imageMap?: Map<string, CanvasImageSource>,
): void {
  ctx.save();

  if (bg.type === "solid") {
    ctx.fillStyle = bg.color;
    ctx.fillRect(0, 0, width, height);
  } else if (bg.type === "gradient") {
    const angleRad = ((bg.angle ?? 135) * Math.PI) / 180;
    const x2 = width * Math.cos(angleRad);
    const y2 = height * Math.sin(angleRad);
    const grad = ctx.createLinearGradient(0, 0, Math.abs(x2), Math.abs(y2));
    grad.addColorStop(0, bg.stops[0]);
    grad.addColorStop(1, bg.stops[1]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
  } else if (bg.type === "blur") {
    // Find media for blur background
    const sourceCell =
      cells.find((c) => c.id === bg.sourceCellId && c.media?.url) ||
      cells.find((c) => c.media?.url);

    const img = sourceCell?.media?.url
      ? imageMap?.get(sourceCell.media.url) || sourceCell.media.element
      : undefined;

    if (img) {
      ctx.save();
      ctx.filter = "blur(40px) brightness(0.7)";
      // Draw oversized to cover blur edges
      ctx.drawImage(img, -width * 0.1, -height * 0.1, width * 1.2, height * 1.2);
      ctx.restore();
    } else {
      ctx.fillStyle = "#1c1412";
      ctx.fillRect(0, 0, width, height);
    }
  }

  ctx.restore();
}

/**
 * Draws a single cell with clipping, transformations, filters, and borders.
 */
function drawCell(
  ctx: CanvasRenderingContext2D,
  rect: ComputedCellRect,
  transform: CellTransform | undefined,
  mediaSource: CanvasImageSource | undefined,
  timeSec: number,
): void {
  const { x, y, width, height, shape, rotation, cornerRadius } = rect;

  ctx.save();

  // If cell has rotation (e.g. polaroid or freeform), rotate around cell center
  const centerX = x + width / 2;
  const centerY = y + height / 2;

  if (rotation !== 0) {
    ctx.translate(centerX, centerY);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  // Handle Polaroid frame
  if (shape === "polaroid") {
    const polaroidMargin = Math.max(6, Math.min(width, height) * 0.06);
    const polaroidBottomMargin = polaroidMargin * 3.5;

    // Draw white card backing with shadow
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = "#ffffff";
    addRoundRectPath(ctx, x, y, width, height, 4);
    ctx.fill();

    // Reset shadow for inner photo
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    const photoX = x + polaroidMargin;
    const photoY = y + polaroidMargin;
    const photoW = width - polaroidMargin * 2;
    const photoH = height - polaroidMargin - polaroidBottomMargin;

    if (mediaSource) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(photoX, photoY, photoW, photoH);
      ctx.clip();
      drawTransformedImage(ctx, photoX, photoY, photoW, photoH, mediaSource, transform, timeSec);
      ctx.restore();
    } else {
      drawEmptyCellPlaceholder(ctx, photoX, photoY, photoW, photoH, 0);
    }

    ctx.restore();
    return;
  }

  // Handle Circle or Rounded Rectangle clipping
  ctx.beginPath();
  if (shape === "circle") {
    const radius = Math.min(width, height) / 2;
    ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
  } else {
    addRoundRectPath(ctx, x, y, width, height, cornerRadius);
  }
  ctx.clip();

  if (mediaSource) {
    drawTransformedImage(ctx, x, y, width, height, mediaSource, transform, timeSec);
  } else {
    drawEmptyCellPlaceholder(ctx, x, y, width, height, cornerRadius);
  }

  ctx.restore();
}

/**
 * Draws transformed (panned, zoomed, rotated, flipped, filtered) image into cell rect.
 */
function drawTransformedImage(
  ctx: CanvasRenderingContext2D,
  destX: number,
  destY: number,
  destW: number,
  destH: number,
  source: CanvasImageSource,
  transform: CellTransform | undefined,
  timeSec: number,
): void {
  const tf = transform ?? createDefaultCellTransform();

  // Determine source natural dimensions
  const srcW =
    (source as HTMLImageElement).naturalWidth ||
    (source as HTMLVideoElement).videoWidth ||
    (source as HTMLCanvasElement).width ||
    destW;
  const srcH =
    (source as HTMLImageElement).naturalHeight ||
    (source as HTMLVideoElement).videoHeight ||
    (source as HTMLCanvasElement).height ||
    destH;

  // Compute cover crop
  const scaleCover = Math.max(destW / srcW, destH / srcH) * tf.zoom;
  const drawW = srcW * scaleCover;
  const drawH = srcH * scaleCover;

  // Pan offsets (pan is in -1..1 range)
  const maxPanX = (drawW - destW) / 2;
  const maxPanY = (drawH - destH) / 2;
  const offsetX = destX + (destW - drawW) / 2 + tf.pan.x * maxPanX;
  const offsetY = destY + (destH - drawH) / 2 + tf.pan.y * maxPanY;

  ctx.save();

  // Apply cell user rotation & flips around dest center
  const cellCenterX = destX + destW / 2;
  const cellCenterY = destY + destH / 2;
  ctx.translate(cellCenterX, cellCenterY);

  if (tf.rotation !== 0) {
    ctx.rotate((tf.rotation * Math.PI) / 180);
  }
  if (tf.flipH || tf.flipV) {
    ctx.scale(tf.flipH ? -1 : 1, tf.flipV ? -1 : 1);
  }
  ctx.translate(-cellCenterX, -cellCenterY);

  // Apply CSS Photo filter if selected
  const photoFilter = PHOTO_FILTERS.find((f) => f.id === tf.filterId);
  if (photoFilter && photoFilter.css !== "none") {
    ctx.filter = photoFilter.css;
  }

  // Draw image
  ctx.drawImage(source, offsetX, offsetY, drawW, drawH);
  ctx.restore();

  // If a fun filter (like Flame-Grilled, Cheese Melt, Retro Comic) is selected:
  if (tf.filterId && isFunFilter(tf.filterId)) {
    applyFunFilterToRect(ctx, destX, destY, destW, destH, tf.filterId, timeSec, tf.filterIntensity);
  }
}

/**
 * Applies pixel-level Fun Filter to a specific rectangular region of the canvas.
 */
function applyFunFilterToRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  filterId: string,
  timeSec: number,
  intensity = 1,
): void {
  try {
    const rx = Math.max(0, Math.round(x));
    const ry = Math.max(0, Math.round(y));
    const rw = Math.min(ctx.canvas.width - rx, Math.round(w));
    const rh = Math.min(ctx.canvas.height - ry, Math.round(h));

    if (rw <= 0 || rh <= 0) return;

    const imgData = ctx.getImageData(rx, ry, rw, rh);
    applyFunFilter(imgData, filterId, { timeSec, intensity });
    ctx.putImageData(imgData, rx, ry);
  } catch {
    // Canvas tainted or inaccessible in test mock, ignore gracefully
  }
}

/**
 * Draws clean empty cell placeholder with subtle dashed border and plus icon.
 */
function drawEmptyCellPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
): void {
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
  addRoundRectPath(ctx, x, y, w, h, radius);
  ctx.fill();

  ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 6]);
  ctx.stroke();

  // Plus icon in center
  const cx = x + w / 2;
  const cy = y + h / 2;
  const plusSize = Math.max(10, Math.min(w, h) * 0.12);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(cx - plusSize, cy);
  ctx.lineTo(cx + plusSize, cy);
  ctx.moveTo(cx, cy - plusSize);
  ctx.lineTo(cx, cy + plusSize);
  ctx.stroke();

  ctx.restore();
}
