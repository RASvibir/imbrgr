/**
 * Pure transformations and layout calculators for the Landing Result Rail.
 * Separated from React components for deterministic unit testing.
 */

export interface MemeLayout {
  topText: string;
  bottomText: string;
  fontSize: number;
  topY: number;
  bottomY: number;
  strokeWidth: number;
}

export interface CollageSlice {
  id: string;
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  dx: number;
  dy: number;
  dw: number;
  dh: number;
  label?: string;
}

/**
 * Computes meme typography positioning based on canvas dimensions.
 */
export function calculateMemeLayout(
  width: number,
  height: number,
  topText = "DROP IT, SEE IT",
  bottomText = "COOKED IN 10 SECONDS",
): MemeLayout {
  const minDim = Math.min(width, height);
  const fontSize = Math.max(16, Math.round(minDim * 0.09));
  const strokeWidth = Math.max(2, Math.round(fontSize * 0.15));

  return {
    topText,
    bottomText,
    fontSize,
    topY: Math.round(fontSize * 1.2),
    bottomY: Math.round(height - fontSize * 0.4),
    strokeWidth,
  };
}

/**
 * Computes a 3-panel dynamic collage partition for an image canvas.
 * Split: Left 55% full view, Top Right 45% detail zoom, Bottom Right 45% mirrored crop.
 */
export function calculateCollageSlices(
  width: number,
  height: number,
  gap = 4,
): CollageSlice[] {
  const leftW = Math.round(width * 0.55) - Math.round(gap / 2);
  const rightX = leftW + gap;
  const rightW = width - rightX;
  const topH = Math.round(height * 0.5) - Math.round(gap / 2);
  const bottomY = topH + gap;
  const bottomH = height - bottomY;

  return [
    {
      id: "main",
      sx: 0,
      sy: 0,
      sw: width,
      sh: height,
      dx: 0,
      dy: 0,
      dw: leftW,
      dh: height,
      label: "Main",
    },
    {
      id: "zoom",
      sx: Math.round(width * 0.25),
      sy: Math.round(height * 0.25),
      sw: Math.round(width * 0.5),
      sh: Math.round(height * 0.5),
      dx: rightX,
      dy: 0,
      dw: rightW,
      dh: topH,
      label: "Detail",
    },
    {
      id: "bottom",
      sx: 0,
      sy: Math.round(height * 0.2),
      sw: width,
      sh: Math.round(height * 0.8),
      dx: rightX,
      dy: bottomY,
      dw: rightW,
      dh: bottomH,
      label: "Alt",
    },
  ];
}

/**
 * Builds a navigation URL to a novelty tool, embedding origin tracking and handoff ID.
 */
export function buildToolUrl(
  baseRoute: string,
  handoffId: string | null,
): string {
  const sep = baseRoute.includes("?") ? "&" : "?";
  if (!handoffId) {
    return `${baseRoute}${sep}from=landing`;
  }
  return `${baseRoute}${sep}from=landing&handoff=${encodeURIComponent(handoffId)}`;
}
