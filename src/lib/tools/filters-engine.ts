/**
 * Pure state and rendering operations for the Photo & Video Filters tool.
 * Deterministic, unit-tested, client-side friendly.
 */

import { applyAnyFilter } from "@/lib/filter-registry";

export interface FilterStackLayer {
  id: string; // unique layer instance id
  filterId: string; // preset id (e.g. "cinematic-teal-orange")
  intensity: number; // 0 to 1
  enabled: boolean;
}

export const MAX_FILTER_STACK = 3;

export const DEFAULT_SAMPLE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="sky" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e1b4b"/>
        <stop offset="40%" stop-color="#f97316"/>
        <stop offset="70%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="#db2777"/>
      </linearGradient>
      <radialGradient id="sun" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#fffbeb"/>
        <stop offset="60%" stop-color="#fbbf24"/>
        <stop offset="100%" stop-color="transparent"/>
      </radialGradient>
    </defs>
    <rect width="800" height="600" fill="url(#sky)"/>
    <circle cx="400" cy="280" r="140" fill="url(#sun)"/>
    <!-- Mountain ridges -->
    <path d="M0,480 L180,340 L340,460 L520,310 L700,450 L800,370 L800,600 L0,600 Z" fill="#18181b" opacity="0.85"/>
    <path d="M0,520 L220,400 L420,530 L620,410 L800,500 L800,600 L0,600 Z" fill="#09090b"/>
    <!-- Water reflection -->
    <rect y="540" width="800" height="60" fill="#0f172a" opacity="0.9"/>
    <text x="400" y="580" font-family="system-ui,sans-serif" font-weight="bold" font-size="24" fill="#f5ebe3" text-anchor="middle" letter-spacing="4">IMBRGR AESTHETICS</text>
  </svg>`,
)}`;

/**
 * Creates a new filter layer.
 */
export function createFilterLayer(filterId: string, intensity = 1): FilterStackLayer {
  return {
    id: `layer-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    filterId,
    intensity: Math.max(0, Math.min(1, intensity)),
    enabled: true,
  };
}

/**
 * Applies a stack of up to 3 filter layers sequentially onto an ImageData buffer.
 * Preserves the alpha channel intact.
 */
export function applyFilterStack(
  img: ImageData,
  stack: FilterStackLayer[],
  timeSec = 0,
): void {
  const activeLayers = stack.filter((l) => l.enabled && l.filterId !== "none" && l.intensity > 0);
  for (const layer of activeLayers) {
    applyAnyFilter(img, layer.filterId, {
      timeSec,
      intensity: layer.intensity,
    });
  }
}

/**
 * Renders an image or video frame with split comparison into a canvas.
 * Split ratio: 0 (100% original) to 100 (100% filtered).
 */
export function renderComparisonFrame(
  ctx: CanvasRenderingContext2D,
  originalCanvas: HTMLCanvasElement | ImageBitmap,
  filteredCanvas: HTMLCanvasElement,
  splitRatio = 100,
  showDivider = true,
): void {
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;
  const ratio = Math.max(0, Math.min(100, splitRatio)) / 100;

  ctx.clearRect(0, 0, w, h);

  if (ratio >= 1) {
    // 100% filtered
    ctx.drawImage(filteredCanvas, 0, 0, w, h);
    return;
  }

  if (ratio <= 0) {
    // 100% original
    ctx.drawImage(originalCanvas, 0, 0, w, h);
    return;
  }

  const splitX = Math.round(w * ratio);

  // Draw filtered on left, original on right (or vice versa: original left, filtered right)
  // Standard convention: Left = Original (Before), Right = Filtered (After)
  // 1. Draw original on entire canvas
  ctx.drawImage(originalCanvas, 0, 0, w, h);

  // 2. Draw filtered on right side using clipping path
  ctx.save();
  ctx.beginPath();
  ctx.rect(splitX, 0, w - splitX, h);
  ctx.clip();
  ctx.drawImage(filteredCanvas, 0, 0, w, h);
  ctx.restore();

  // 3. Draw vertical divider line
  if (showDivider && splitX > 0 && splitX < w) {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(splitX, 0);
    ctx.lineTo(splitX, h);
    ctx.stroke();

    // Small divider thumb in center
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(splitX, h / 2, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

/**
 * Helper to pick supported MediaRecorder MIME type for video export.
 */
export function pickRecorderMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm;codecs=h264",
    "video/webm",
    "video/mp4",
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c)) return c;
  }
  return "";
}

/**
 * Estimate output byte size for image export.
 */
export function estimateExportSize(
  width: number,
  height: number,
  format: "png" | "jpeg" | "webp",
  quality = 92,
): number {
  const pixels = width * height;
  if (format === "png") {
    return Math.round(pixels * 2.2);
  }
  const qFactor = (quality / 100) * 0.4 + 0.1;
  if (format === "webp") {
    return Math.round(pixels * qFactor * 0.8);
  }
  return Math.round(pixels * qFactor);
}
