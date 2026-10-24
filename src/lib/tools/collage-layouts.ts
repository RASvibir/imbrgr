/**
 * Collage Layout Engine: normalized rects, templates, layout computation,
 * and free-form cell positioning.
 */

export type CellShape = "rect" | "circle" | "polaroid";

export type CollageCategory =
  | "all"
  | "grid"
  | "split"
  | "hero"
  | "filmstrip"
  | "polaroid"
  | "circle"
  | "freeform";

export interface NormalizedCell {
  id: string;
  x: number; // 0 to 1
  y: number; // 0 to 1
  width: number; // 0 to 1
  height: number; // 0 to 1
  shape?: CellShape;
  rotation?: number; // degrees, e.g. -6 to +6 for polaroids
  zIndex?: number;
}

export type CollageAspect = "1:1" | "4:5" | "9:16" | "16:9" | "custom";

export interface CollageLayoutTemplate {
  id: string;
  name: string;
  cellCount: number;
  category: CollageCategory;
  description: string;
  defaultAspect?: CollageAspect;
  cells: NormalizedCell[];
}

export interface ComputedCellRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  shape: CellShape;
  rotation: number;
  cornerRadius: number;
  zIndex: number;
}

export interface LayoutComputeOptions {
  collageWidth: number;
  collageHeight: number;
  padding: number;
  gap: number;
  cornerRadius: number;
}

/* ==========================================================================
 * 20+ Built-in Collage Layout Templates across 2 to 9 cells
 * ========================================================================== */

export const COLLAGE_TEMPLATES: CollageLayoutTemplate[] = [
  // --- 2 Cells ---
  {
    id: "split-v",
    name: "Side by Side",
    cellCount: 2,
    category: "split",
    description: "2 equal vertical columns",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.5, height: 1 },
      { id: "c2", x: 0.5, y: 0, width: 0.5, height: 1 },
    ],
  },
  {
    id: "split-h",
    name: "Stacked Split",
    cellCount: 2,
    category: "split",
    description: "2 equal horizontal rows",
    cells: [
      { id: "c1", x: 0, y: 0, width: 1, height: 0.5 },
      { id: "c2", x: 0, y: 0.5, width: 1, height: 0.5 },
    ],
  },
  {
    id: "split-1-3-2-3",
    name: "Wide Right Split",
    cellCount: 2,
    category: "split",
    description: "1/3 narrow column left, 2/3 wide column right",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.3333, height: 1 },
      { id: "c2", x: 0.3333, y: 0, width: 0.6667, height: 1 },
    ],
  },
  {
    id: "split-2-3-1-3",
    name: "Wide Left Split",
    cellCount: 2,
    category: "split",
    description: "2/3 wide column left, 1/3 narrow column right",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.6667, height: 1 },
      { id: "c2", x: 0.6667, y: 0, width: 0.3333, height: 1 },
    ],
  },

  // --- 3 Cells ---
  {
    id: "hero-left-2-right",
    name: "Hero Left + 2",
    cellCount: 3,
    category: "hero",
    description: "Large showcase cell left with 2 stacked thumbs right",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.5, height: 1 },
      { id: "c2", x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { id: "c3", x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
  {
    id: "hero-top-2-bottom",
    name: "Hero Top + 2",
    cellCount: 3,
    category: "hero",
    description: "Wide showcase header cell with 2 columns below",
    cells: [
      { id: "c1", x: 0, y: 0, width: 1, height: 0.5 },
      { id: "c2", x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { id: "c3", x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
  {
    id: "grid-3-cols",
    name: "Triptych 3 Columns",
    cellCount: 3,
    category: "grid",
    description: "3 vertical triptych columns",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.3333, height: 1 },
      { id: "c2", x: 0.3333, y: 0, width: 0.3334, height: 1 },
      { id: "c3", x: 0.6667, y: 0, width: 0.3333, height: 1 },
    ],
  },
  {
    id: "grid-3-rows",
    name: "Triptych 3 Rows",
    cellCount: 3,
    category: "grid",
    description: "3 horizontal stacked rows",
    cells: [
      { id: "c1", x: 0, y: 0, width: 1, height: 0.3333 },
      { id: "c2", x: 0, y: 0.3333, width: 1, height: 0.3334 },
      { id: "c3", x: 0, y: 0.6667, width: 1, height: 0.3333 },
    ],
  },
  {
    id: "polaroid-3",
    name: "Polaroid Trio",
    cellCount: 3,
    category: "polaroid",
    description: "3 layered polaroids with vintage angles",
    cells: [
      { id: "c1", x: 0.05, y: 0.1, width: 0.45, height: 0.65, shape: "polaroid", rotation: -6, zIndex: 1 },
      { id: "c2", x: 0.5, y: 0.15, width: 0.45, height: 0.65, shape: "polaroid", rotation: 5, zIndex: 2 },
      { id: "c3", x: 0.28, y: 0.28, width: 0.46, height: 0.65, shape: "polaroid", rotation: -1, zIndex: 3 },
    ],
  },

  // --- 4 Cells ---
  {
    id: "grid-2x2",
    name: "Classic 2x2 Grid",
    cellCount: 4,
    category: "grid",
    description: "Balanced 4-photo square quadrant grid",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.5, height: 0.5 },
      { id: "c2", x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { id: "c3", x: 0, y: 0.5, width: 0.5, height: 0.5 },
      { id: "c4", x: 0.5, y: 0.5, width: 0.5, height: 0.5 },
    ],
  },
  {
    id: "hero-left-3-right",
    name: "Hero Left + 3 Stack",
    cellCount: 4,
    category: "hero",
    description: "Dominant 2/3 hero column with 3 stacked thumbs right",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.6, height: 1 },
      { id: "c2", x: 0.6, y: 0, width: 0.4, height: 0.3333 },
      { id: "c3", x: 0.6, y: 0.3333, width: 0.4, height: 0.3334 },
      { id: "c4", x: 0.6, y: 0.6667, width: 0.4, height: 0.3333 },
    ],
  },
  {
    id: "filmstrip-4",
    name: "4-Frame Filmstrip",
    cellCount: 4,
    category: "filmstrip",
    description: "Vertical storytelling 4-frame filmstrip",
    cells: [
      { id: "c1", x: 0, y: 0, width: 1, height: 0.25 },
      { id: "c2", x: 0, y: 0.25, width: 1, height: 0.25 },
      { id: "c3", x: 0, y: 0.5, width: 1, height: 0.25 },
      { id: "c4", x: 0, y: 0.75, width: 1, height: 0.25 },
    ],
  },
  {
    id: "polaroid-scatter-4",
    name: "Polaroid Scatter",
    cellCount: 4,
    category: "polaroid",
    description: "Casual desktop photo scatter with organic rotations",
    cells: [
      { id: "c1", x: 0.05, y: 0.05, width: 0.44, height: 0.48, shape: "polaroid", rotation: -5, zIndex: 1 },
      { id: "c2", x: 0.51, y: 0.06, width: 0.44, height: 0.48, shape: "polaroid", rotation: 4, zIndex: 2 },
      { id: "c3", x: 0.07, y: 0.48, width: 0.44, height: 0.48, shape: "polaroid", rotation: 3, zIndex: 3 },
      { id: "c4", x: 0.49, y: 0.47, width: 0.44, height: 0.48, shape: "polaroid", rotation: -4, zIndex: 4 },
    ],
  },

  // --- 5 Cells ---
  {
    id: "hero-top-4-bottom",
    name: "Hero Top + 4 Grid",
    cellCount: 5,
    category: "hero",
    description: "Panoramic hero on top with 4 columns along the bottom",
    cells: [
      { id: "c1", x: 0, y: 0, width: 1, height: 0.6 },
      { id: "c2", x: 0, y: 0.6, width: 0.25, height: 0.4 },
      { id: "c3", x: 0.25, y: 0.6, width: 0.25, height: 0.4 },
      { id: "c4", x: 0.5, y: 0.6, width: 0.25, height: 0.4 },
      { id: "c5", x: 0.75, y: 0.6, width: 0.25, height: 0.4 },
    ],
  },
  {
    id: "split-2-top-3-bottom",
    name: "2 Top / 3 Bottom",
    cellCount: 5,
    category: "split",
    description: "2 large photos on top, 3 smaller photos below",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.5, height: 0.5 },
      { id: "c2", x: 0.5, y: 0, width: 0.5, height: 0.5 },
      { id: "c3", x: 0, y: 0.5, width: 0.3333, height: 0.5 },
      { id: "c4", x: 0.3333, y: 0.5, width: 0.3334, height: 0.5 },
      { id: "c5", x: 0.6667, y: 0.5, width: 0.3333, height: 0.5 },
    ],
  },
  {
    id: "circles-5",
    name: "Bubble Circles",
    cellCount: 5,
    category: "circle",
    description: "5 circular bubble portrait cameos",
    cells: [
      { id: "c1", x: 0.05, y: 0.05, width: 0.42, height: 0.42, shape: "circle" },
      { id: "c2", x: 0.53, y: 0.05, width: 0.42, height: 0.42, shape: "circle" },
      { id: "c3", x: 0.29, y: 0.29, width: 0.42, height: 0.42, shape: "circle", zIndex: 5 },
      { id: "c4", x: 0.05, y: 0.53, width: 0.42, height: 0.42, shape: "circle" },
      { id: "c5", x: 0.53, y: 0.53, width: 0.42, height: 0.42, shape: "circle" },
    ],
  },

  // --- 6 Cells ---
  {
    id: "grid-2x3",
    name: "2x3 Grid (6 Photos)",
    cellCount: 6,
    category: "grid",
    description: "2 rows of 3 columns each",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.3333, height: 0.5 },
      { id: "c2", x: 0.3333, y: 0, width: 0.3334, height: 0.5 },
      { id: "c3", x: 0.6667, y: 0, width: 0.3333, height: 0.5 },
      { id: "c4", x: 0, y: 0.5, width: 0.3333, height: 0.5 },
      { id: "c5", x: 0.3333, y: 0.5, width: 0.3334, height: 0.5 },
      { id: "c6", x: 0.6667, y: 0.5, width: 0.3333, height: 0.5 },
    ],
  },
  {
    id: "grid-3x2",
    name: "3x2 Grid (6 Photos)",
    cellCount: 6,
    category: "grid",
    description: "3 rows of 2 columns each",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.5, height: 0.3333 },
      { id: "c2", x: 0.5, y: 0, width: 0.5, height: 0.3333 },
      { id: "c3", x: 0, y: 0.3333, width: 0.5, height: 0.3334 },
      { id: "c4", x: 0.5, y: 0.3333, width: 0.5, height: 0.3334 },
      { id: "c5", x: 0, y: 0.6667, width: 0.5, height: 0.3333 },
      { id: "c6", x: 0.5, y: 0.6667, width: 0.5, height: 0.3333 },
    ],
  },
  {
    id: "hero-left-5-thumbs",
    name: "Hero Left + 5 Thumbs",
    cellCount: 6,
    category: "hero",
    description: "Hero showcase left with 5 thumbs grid on right",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.5, height: 1 },
      { id: "c2", x: 0.5, y: 0, width: 0.5, height: 0.3333 },
      { id: "c3", x: 0.5, y: 0.3333, width: 0.25, height: 0.3334 },
      { id: "c4", x: 0.75, y: 0.3333, width: 0.25, height: 0.3334 },
      { id: "c5", x: 0.5, y: 0.6667, width: 0.25, height: 0.3333 },
      { id: "c6", x: 0.75, y: 0.6667, width: 0.25, height: 0.3333 },
    ],
  },

  // --- 7 Cells ---
  {
    id: "hero-center-6-surround",
    name: "Center Hero + 6 Surround",
    cellCount: 7,
    category: "hero",
    description: "Focal center hero surrounded by 6 side panels",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.25, height: 0.5 },
      { id: "c2", x: 0, y: 0.5, width: 0.25, height: 0.5 },
      { id: "c3", x: 0.25, y: 0, width: 0.5, height: 0.65 },
      { id: "c4", x: 0.25, y: 0.65, width: 0.25, height: 0.35 },
      { id: "c5", x: 0.5, y: 0.65, width: 0.25, height: 0.35 },
      { id: "c6", x: 0.75, y: 0, width: 0.25, height: 0.5 },
      { id: "c7", x: 0.75, y: 0.5, width: 0.25, height: 0.5 },
    ],
  },

  // --- 8 Cells ---
  {
    id: "grid-4x2",
    name: "4x2 Mosaic (8 Photos)",
    cellCount: 8,
    category: "grid",
    description: "2 rows of 4 photos each",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.25, height: 0.5 },
      { id: "c2", x: 0.25, y: 0, width: 0.25, height: 0.5 },
      { id: "c3", x: 0.5, y: 0, width: 0.25, height: 0.5 },
      { id: "c4", x: 0.75, y: 0, width: 0.25, height: 0.5 },
      { id: "c5", x: 0, y: 0.5, width: 0.25, height: 0.5 },
      { id: "c6", x: 0.25, y: 0.5, width: 0.25, height: 0.5 },
      { id: "c7", x: 0.5, y: 0.5, width: 0.25, height: 0.5 },
      { id: "c8", x: 0.75, y: 0.5, width: 0.25, height: 0.5 },
    ],
  },

  // --- 9 Cells ---
  {
    id: "grid-3x3",
    name: "3x3 Instagram Mosaic",
    cellCount: 9,
    category: "grid",
    description: "Classic 9-square grid mosaic",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.3333, height: 0.3333 },
      { id: "c2", x: 0.3333, y: 0, width: 0.3334, height: 0.3333 },
      { id: "c3", x: 0.6667, y: 0, width: 0.3333, height: 0.3333 },
      { id: "c4", x: 0, y: 0.3333, width: 0.3333, height: 0.3334 },
      { id: "c5", x: 0.3333, y: 0.3333, width: 0.3334, height: 0.3334 },
      { id: "c6", x: 0.6667, y: 0.3333, width: 0.3333, height: 0.3334 },
      { id: "c7", x: 0, y: 0.6667, width: 0.3333, height: 0.3333 },
      { id: "c8", x: 0.3333, y: 0.6667, width: 0.3334, height: 0.3333 },
      { id: "c9", x: 0.6667, y: 0.6667, width: 0.3333, height: 0.3333 },
    ],
  },
  {
    id: "hero-center-8-border",
    name: "Center Hero + 8 Frame",
    cellCount: 9,
    category: "hero",
    description: "Prominent center frame surrounded by 8 border frames",
    cells: [
      { id: "c1", x: 0, y: 0, width: 0.3333, height: 0.25 },
      { id: "c2", x: 0.3333, y: 0, width: 0.3334, height: 0.25 },
      { id: "c3", x: 0.6667, y: 0, width: 0.3333, height: 0.25 },
      { id: "c4", x: 0, y: 0.25, width: 0.25, height: 0.5 },
      { id: "c5", x: 0.25, y: 0.25, width: 0.5, height: 0.5, zIndex: 2 },
      { id: "c6", x: 0.75, y: 0.25, width: 0.25, height: 0.5 },
      { id: "c7", x: 0, y: 0.75, width: 0.3333, height: 0.25 },
      { id: "c8", x: 0.3333, y: 0.75, width: 0.3334, height: 0.25 },
      { id: "c9", x: 0.6667, y: 0.75, width: 0.3333, height: 0.25 },
    ],
  },

  // --- Free-form Mode ---
  {
    id: "freeform",
    name: "Free-Form Canvas",
    cellCount: 3,
    category: "freeform",
    description: "Position, scale, rotate, and layer photos anywhere on canvas",
    cells: [
      { id: "c1", x: 0.08, y: 0.1, width: 0.5, height: 0.5, rotation: -4, zIndex: 1 },
      { id: "c2", x: 0.42, y: 0.2, width: 0.5, height: 0.5, rotation: 5, zIndex: 2 },
      { id: "c3", x: 0.22, y: 0.45, width: 0.55, height: 0.48, rotation: -2, zIndex: 3 },
    ],
  },
];

export const TEMPLATE_MAP = new Map<string, CollageLayoutTemplate>(
  COLLAGE_TEMPLATES.map((t) => [t.id, t]),
);

export function getTemplateById(id: string): CollageLayoutTemplate {
  return TEMPLATE_MAP.get(id) ?? COLLAGE_TEMPLATES[0];
}

/* ==========================================================================
 * Cell Coordinate and Dimension Computation Engine
 * ========================================================================== */

/**
 * Computes exact pixel rectangles for all cells given canvas size, padding, gap, and radius.
 * Ensures cells tile strictly within the outer padding bounds without clipping or overflow.
 */
export function computeCellRects(
  cells: NormalizedCell[],
  options: LayoutComputeOptions,
): ComputedCellRect[] {
  const { collageWidth, collageHeight, padding, gap, cornerRadius } = options;

  const innerX = padding;
  const innerY = padding;
  const innerWidth = Math.max(10, collageWidth - padding * 2);
  const innerHeight = Math.max(10, collageHeight - padding * 2);

  return cells.map((cell) => {
    const isPolaroid = cell.shape === "polaroid";
    const isCircle = cell.shape === "circle";

    let pixelX: number;
    let pixelY: number;
    let pixelW: number;
    let pixelH: number;

    if (isPolaroid || cell.rotation) {
      // Polaroid or rotated cards: position based on inner bounds with padding safety
      pixelX = innerX + cell.x * innerWidth;
      pixelY = innerY + cell.y * innerHeight;
      pixelW = cell.width * innerWidth;
      pixelH = cell.height * innerHeight;
    } else {
      // Tiled layout: subtract gap at interior borders
      const leftInset = cell.x > 0.001 ? gap / 2 : 0;
      const rightInset = cell.x + cell.width < 0.999 ? gap / 2 : 0;
      const topInset = cell.y > 0.001 ? gap / 2 : 0;
      const bottomInset = cell.y + cell.height < 0.999 ? gap / 2 : 0;

      pixelX = innerX + cell.x * innerWidth + leftInset;
      pixelY = innerY + cell.y * innerHeight + topInset;
      pixelW = Math.max(1, cell.width * innerWidth - (leftInset + rightInset));
      pixelH = Math.max(1, cell.height * innerHeight - (topInset + bottomInset));
    }

    // Clamp inside absolute canvas bounds [padding, dimension - padding]
    const clampedX = Math.max(padding, Math.min(collageWidth - padding - 1, pixelX));
    const clampedY = Math.max(padding, Math.min(collageHeight - padding - 1, pixelY));
    const maxAllowedW = Math.max(1, collageWidth - padding - clampedX);
    const maxAllowedH = Math.max(1, collageHeight - padding - clampedY);

    const safeW = Math.min(pixelW, maxAllowedW);
    const safeH = Math.min(pixelH, maxAllowedH);

    // Circle shape uses square bounds
    const effectiveW = isCircle ? Math.min(safeW, safeH) : safeW;
    const effectiveH = isCircle ? Math.min(safeW, safeH) : safeH;

    const safeRadius = isCircle
      ? Math.min(effectiveW, effectiveH) / 2
      : Math.min(cornerRadius, effectiveW / 2, effectiveH / 2);

    return {
      id: cell.id,
      x: clampedX,
      y: clampedY,
      width: effectiveW,
      height: effectiveH,
      shape: cell.shape ?? "rect",
      rotation: cell.rotation ?? 0,
      cornerRadius: safeRadius,
      zIndex: cell.zIndex ?? 0,
    };
  });
}

/**
 * Calculates canvas pixel width and height for a target aspect ratio.
 */
export function calculateCollageDimensions(
  aspect: CollageAspect,
  customWidth = 1080,
  customHeight = 1080,
  maxDimension = 1200,
): { width: number; height: number } {
  switch (aspect) {
    case "1:1":
      return { width: maxDimension, height: maxDimension };
    case "4:5":
      return { width: Math.round((maxDimension * 4) / 5), height: maxDimension };
    case "9:16":
      return { width: Math.round((maxDimension * 9) / 16), height: maxDimension };
    case "16:9":
      return { width: maxDimension, height: Math.round((maxDimension * 9) / 16) };
    case "custom": {
      const cw = Math.max(300, Math.min(4000, customWidth));
      const ch = Math.max(300, Math.min(4000, customHeight));
      return { width: cw, height: ch };
    }
  }
}
