/**
 * Pure canvas rendering engine, layer math, and state operations for Meme Maker.
 * Deterministic and testable in both browser and Node.js environments.
 */

export type MemeAspect = "1:1" | "4:5" | "16:9" | "original";

export type MemeShapeType = "rectangle" | "circle" | "speech-bubble" | "arrow" | "star";

export interface BaseMemeLayer {
  id: string;
  name: string;
  x: number; // Center X in canvas coordinates
  y: number; // Center Y in canvas coordinates
  width: number;
  height: number;
  rotation: number; // Degrees: 0-360
  scale: number; // Scale multiplier, default 1
  opacity: number; // 0-1
  locked: boolean;
  visible: boolean;
}

export interface MemeTextLayer extends BaseMemeLayer {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  shadow: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  align: "left" | "center" | "right";
  allCaps: boolean;
  lineHeight: number;
}

export interface MemeImageLayer extends BaseMemeLayer {
  type: "image";
  src: string;
  originalWidth: number;
  originalHeight: number;
  isBackground?: boolean;
}

export interface MemeStickerLayer extends BaseMemeLayer {
  type: "sticker";
  emoji: string;
}

export interface MemeShapeLayer extends BaseMemeLayer {
  type: "shape";
  shape: MemeShapeType;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

export type MemeLayer =
  | MemeTextLayer
  | MemeImageLayer
  | MemeStickerLayer
  | MemeShapeLayer;

export interface MemeCanvasState {
  width: number;
  height: number;
  aspectRatio: MemeAspect;
  backgroundColor: string;
  layers: MemeLayer[];
  selectedLayerId: string | null;
}

export const MEME_FONTS = [
  { id: "impact", label: "Impact", stack: 'Impact, "Arial Black", "Trebuchet MS", sans-serif' },
  { id: "sans", label: "Modern Sans", stack: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  { id: "comic", label: "Comic Sans", stack: '"Comic Sans MS", "Comic Neue", cursive, sans-serif' },
  { id: "serif", label: "Classic Serif", stack: 'Georgia, "Times New Roman", serif' },
  { id: "mono", label: "Retro Mono", stack: '"Courier New", Courier, monospace' },
];

let idCounter = 1;

export function createLayerId(prefix = "layer"): string {
  const ts = Date.now();
  const id = `${prefix}-${ts}-${idCounter++}`;
  return id;
}

export function resetLayerIdCounterForTesting(val = 1): void {
  idCounter = val;
}

/**
 * Calculates canvas width and height based on aspect ratio and base dimension.
 */
export function calculateCanvasDimensions(
  baseWidth: number,
  baseHeight: number,
  aspect: MemeAspect,
  maxDimension = 800,
): { width: number; height: number } {
  if (aspect === "original") {
    if (baseWidth <= 0 || baseHeight <= 0) {
      return { width: maxDimension, height: maxDimension };
    }
    const ratio = baseWidth / baseHeight;
    if (ratio >= 1) {
      const width = maxDimension;
      const height = Math.max(100, Math.round(maxDimension / ratio));
      return { width, height };
    } else {
      const height = maxDimension;
      const width = Math.max(100, Math.round(maxDimension * ratio));
      return { width, height };
    }
  }

  if (aspect === "1:1") {
    return { width: maxDimension, height: maxDimension };
  }

  if (aspect === "4:5") {
    return { width: Math.round(maxDimension * 0.8), height: maxDimension };
  }

  if (aspect === "16:9") {
    return { width: maxDimension, height: Math.round((maxDimension * 9) / 16) };
  }

  return { width: maxDimension, height: maxDimension };
}

/**
 * Creates default meme state with classic Top and Bottom text layers.
 */
export function createDefaultMemeState(opts?: {
  imageSrc?: string;
  imgWidth?: number;
  imgHeight?: number;
  aspect?: MemeAspect;
}): MemeCanvasState {
  const aspect = opts?.aspect ?? "1:1";
  const { width, height } = calculateCanvasDimensions(
    opts?.imgWidth ?? 800,
    opts?.imgHeight ?? 800,
    aspect,
    800,
  );

  const layers: MemeLayer[] = [];

  if (opts?.imageSrc) {
    layers.push({
      id: "layer-bg-image",
      type: "image",
      name: "Background Image",
      x: width / 2,
      y: height / 2,
      width,
      height,
      rotation: 0,
      scale: 1,
      opacity: 1,
      locked: true,
      visible: true,
      src: opts.imageSrc,
      originalWidth: opts.imgWidth ?? width,
      originalHeight: opts.imgHeight ?? height,
      isBackground: true,
    });
  }

  // Classic Top Text
  layers.push({
    id: "layer-text-top",
    type: "text",
    name: "Top Text",
    x: width / 2,
    y: Math.max(45, Math.round(height * 0.1)),
    width: width - 48,
    height: 70,
    rotation: 0,
    scale: 1,
    opacity: 1,
    locked: false,
    visible: true,
    text: "TOP TEXT",
    fontFamily: MEME_FONTS[0].stack,
    fontSize: 48,
    fillColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 5,
    shadow: true,
    shadowColor: "rgba(0,0,0,0.8)",
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    align: "center",
    allCaps: true,
    lineHeight: 1.15,
  });

  // Classic Bottom Text
  layers.push({
    id: "layer-text-bottom",
    type: "text",
    name: "Bottom Text",
    x: width / 2,
    y: Math.min(height - 45, Math.round(height * 0.9)),
    width: width - 48,
    height: 70,
    rotation: 0,
    scale: 1,
    opacity: 1,
    locked: false,
    visible: true,
    text: "BOTTOM TEXT",
    fontFamily: MEME_FONTS[0].stack,
    fontSize: 48,
    fillColor: "#ffffff",
    strokeColor: "#000000",
    strokeWidth: 5,
    shadow: true,
    shadowColor: "rgba(0,0,0,0.8)",
    shadowBlur: 4,
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    align: "center",
    allCaps: true,
    lineHeight: 1.15,
  });

  return {
    width,
    height,
    aspectRatio: aspect,
    backgroundColor: "#141210",
    layers,
    selectedLayerId: "layer-text-top",
  };
}

/**
 * Text wrapping calculation for canvas.
 */
export function wrapTextLines(
  text: string,
  maxWidth: number,
  measureFn: (str: string) => number,
): string[] {
  if (!text) return [""];
  const paragraphs = text.split("\n");
  const lines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      lines.push("");
      continue;
    }
    const words = para.split(/\s+/);
    let currentLine = words[0] || "";

    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const testLine = `${currentLine} ${word}`;
      if (measureFn(testLine) <= maxWidth) {
        currentLine = testLine;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Minimal CanvasRenderingContext2D interface to decouple from browser globals.
 */
export interface CanvasRenderingContext2DLike {
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  rotate(angleRad: number): void;
  scale(x: number, y: number): void;
  clearRect(x: number, y: number, w: number, h: number): void;
  fillRect(x: number, y: number, w: number, h: number): void;
  strokeRect(x: number, y: number, w: number, h: number): void;
  rect?(x: number, y: number, w: number, h: number): void;
  beginPath(): void;
  closePath(): void;
  moveTo(x: number, y: number): void;
  lineTo(x: number, y: number): void;
  arc(x: number, y: number, radius: number, startAngle: number, endAngle: number): void;
  quadraticCurveTo?(cpx: number, cpy: number, x: number, y: number): void;
  fill(): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
  strokeText(text: string, x: number, y: number): void;
  measureText?(text: string): { width: number };
  drawImage(image: unknown, dx: number, dy: number, dw?: number, dh?: number): void;
  fillStyle: string | CanvasGradient | CanvasPattern;
  strokeStyle: string | CanvasGradient | CanvasPattern;
  lineWidth: number;
  lineJoin: CanvasLineJoin;
  lineCap: CanvasLineCap;
  globalAlpha: number;
  font: string;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

/**
 * Pure rendering function for all layers onto any canvas context.
 */
export function renderMemeCanvas(
  ctx: CanvasRenderingContext2DLike,
  state: MemeCanvasState,
  imageMap?: Map<string, unknown>,
): void {
  // Clear and draw background
  ctx.clearRect(0, 0, state.width, state.height);
  ctx.fillStyle = state.backgroundColor;
  ctx.fillRect(0, 0, state.width, state.height);

  for (const layer of state.layers) {
    if (!layer.visible) continue;

    ctx.save();
    ctx.translate(layer.x, layer.y);
    ctx.rotate((layer.rotation * Math.PI) / 180);
    ctx.scale(layer.scale, layer.scale);
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));

    switch (layer.type) {
      case "image":
        renderImageLayer(ctx, layer, imageMap);
        break;
      case "text":
        renderTextLayer(ctx, layer);
        break;
      case "sticker":
        renderStickerLayer(ctx, layer);
        break;
      case "shape":
        renderShapeLayer(ctx, layer);
        break;
    }

    ctx.restore();
  }
}

function renderImageLayer(
  ctx: CanvasRenderingContext2DLike,
  layer: MemeImageLayer,
  imageMap?: Map<string, unknown>,
): void {
  const img = imageMap?.get(layer.src);
  const halfW = layer.width / 2;
  const halfH = layer.height / 2;

  if (img) {
    ctx.drawImage(img, -halfW, -halfH, layer.width, layer.height);
  } else {
    // Placeholder if image element hasn't finished loading yet
    ctx.fillStyle = "#262220";
    ctx.fillRect(-halfW, -halfH, layer.width, layer.height);
    ctx.strokeStyle = "#524840";
    ctx.lineWidth = 2;
    ctx.strokeRect(-halfW, -halfH, layer.width, layer.height);
  }
}

export function renderTextLayer(ctx: CanvasRenderingContext2DLike, layer: MemeTextLayer): void {
  const content = layer.allCaps ? layer.text.toUpperCase() : layer.text;
  const fontSize = Math.max(10, layer.fontSize);
  ctx.font = `bold ${fontSize}px ${layer.fontFamily}`;
  ctx.textAlign = layer.align;
  ctx.textBaseline = "middle";

  const measure = (str: string) => {
    if (ctx.measureText) return ctx.measureText(str).width;
    return str.length * fontSize * 0.6; // Fallback estimate
  };

  const lines = wrapTextLines(content, layer.width, measure);
  const lineHeight = fontSize * (layer.lineHeight || 1.15);
  const totalHeight = lines.length * lineHeight;
  const startY = -totalHeight / 2 + lineHeight / 2;

  let textX = 0;
  if (layer.align === "left") textX = -layer.width / 2;
  else if (layer.align === "right") textX = layer.width / 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = startY + i * lineHeight;

    // Apply shadow if requested
    if (layer.shadow) {
      ctx.shadowColor = layer.shadowColor || "rgba(0,0,0,0.8)";
      ctx.shadowBlur = layer.shadowBlur || 4;
      ctx.shadowOffsetX = layer.shadowOffsetX ?? 2;
      ctx.shadowOffsetY = layer.shadowOffsetY ?? 2;
    } else {
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    // Classic meme text: thick stroke behind fill
    if (layer.strokeWidth > 0 && layer.strokeColor) {
      ctx.lineWidth = layer.strokeWidth * 2;
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineJoin = "round";
      ctx.lineCap = "round";
      ctx.strokeText(line, textX, y);
    }

    ctx.fillStyle = layer.fillColor;
    ctx.fillText(line, textX, y);
  }
}

function renderStickerLayer(ctx: CanvasRenderingContext2DLike, layer: MemeStickerLayer): void {
  const size = Math.min(layer.width, layer.height);
  ctx.font = `${size}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(layer.emoji, 0, 0);
}

function renderShapeLayer(ctx: CanvasRenderingContext2DLike, layer: MemeShapeLayer): void {
  const halfW = layer.width / 2;
  const halfH = layer.height / 2;

  ctx.beginPath();
  switch (layer.shape) {
    case "rectangle":
      if (ctx.rect) {
        ctx.rect(-halfW, -halfH, layer.width, layer.height);
      } else {
        ctx.strokeRect(-halfW, -halfH, layer.width, layer.height);
      }
      break;

    case "circle":
      ctx.arc(0, 0, Math.min(halfW, halfH), 0, Math.PI * 2);
      break;

    case "speech-bubble": {
      // Rounded bubble with bottom-left pointer tail
      const r = 16;
      const w = layer.width;
      const h = layer.height - 24;
      const x = -halfW;
      const y = -halfH;

      ctx.moveTo(x + r, y);
      ctx.lineTo(x + w - r, y);
      if (ctx.quadraticCurveTo) ctx.quadraticCurveTo(x + w, y, x + w, y + r);
      ctx.lineTo(x + w, y + h - r);
      if (ctx.quadraticCurveTo) ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      ctx.lineTo(x + r + 40, y + h);
      ctx.lineTo(x + r, y + h + 24); // tail point
      ctx.lineTo(x + r + 16, y + h);
      ctx.lineTo(x + r, y + h);
      if (ctx.quadraticCurveTo) ctx.quadraticCurveTo(x, y + h, x, y + h - r);
      ctx.lineTo(x, y + r);
      if (ctx.quadraticCurveTo) ctx.quadraticCurveTo(x, y, x + r, y);
      ctx.closePath();
      break;
    }

    case "arrow": {
      // Directed arrow pointing right
      const headSize = Math.min(halfW, halfH);
      const shaftH = halfH * 0.45;
      ctx.moveTo(-halfW, -shaftH);
      ctx.lineTo(halfW - headSize, -shaftH);
      ctx.lineTo(halfW - headSize, -halfH);
      ctx.lineTo(halfW, 0);
      ctx.lineTo(halfW - headSize, halfH);
      ctx.lineTo(halfW - headSize, shaftH);
      ctx.lineTo(-halfW, shaftH);
      ctx.closePath();
      break;
    }

    case "star": {
      const spikes = 5;
      const outerRadius = Math.min(halfW, halfH);
      const innerRadius = outerRadius * 0.45;
      let rot = (Math.PI / 2) * 3;
      const step = Math.PI / spikes;

      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        let sx = Math.cos(rot) * outerRadius;
        let sy = Math.sin(rot) * outerRadius;
        ctx.lineTo(sx, sy);
        rot += step;

        sx = Math.cos(rot) * innerRadius;
        sy = Math.sin(rot) * innerRadius;
        ctx.lineTo(sx, sy);
        rot += step;
      }
      ctx.lineTo(0, -outerRadius);
      ctx.closePath();
      break;
    }
  }

  if (layer.fillColor && layer.fillColor !== "transparent") {
    ctx.fillStyle = layer.fillColor;
    ctx.fill();
  }

  if (layer.strokeWidth > 0 && layer.strokeColor && layer.strokeColor !== "transparent") {
    ctx.lineWidth = layer.strokeWidth;
    ctx.strokeStyle = layer.strokeColor;
    ctx.stroke();
  }
}

/**
 * Handle type for interactive layer selection manipulation.
 */
export type HandleType = "tl" | "tr" | "bl" | "br" | "rot" | "body" | null;

/**
 * Maps screen coordinates (px, py) to the local coordinate system of the layer.
 */
export function screenToLayerLocal(
  px: number,
  py: number,
  layer: MemeLayer,
): { localX: number; localY: number } {
  const dx = px - layer.x;
  const dy = py - layer.y;
  const rad = (-layer.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const localX = (dx * cos - dy * sin) / layer.scale;
  const localY = (dx * sin + dy * cos) / layer.scale;
  return { localX, localY };
}

/**
 * Detects which handle or region of the layer is at point (px, py).
 */
export function getHandleAtPoint(
  px: number,
  py: number,
  layer: MemeLayer,
  tolerance = 16,
): HandleType {
  if (layer.locked || !layer.visible) return null;

  const { localX, localY } = screenToLayerLocal(px, py, layer);
  const halfW = layer.width / 2;
  const halfH = layer.height / 2;
  const tol = tolerance / layer.scale;

  // Rotation handle (28px above top center)
  const rotX = 0;
  const rotY = -halfH - 28;
  const distRotSq = (localX - rotX) ** 2 + (localY - rotY) ** 2;
  if (distRotSq <= tol * tol * 2.2) return "rot";

  // Corner resize handles
  if (Math.abs(localX - -halfW) <= tol && Math.abs(localY - -halfH) <= tol) return "tl";
  if (Math.abs(localX - halfW) <= tol && Math.abs(localY - -halfH) <= tol) return "tr";
  if (Math.abs(localX - -halfW) <= tol && Math.abs(localY - halfH) <= tol) return "bl";
  if (Math.abs(localX - halfW) <= tol && Math.abs(localY - halfH) <= tol) return "br";

  // Body bounding hit test
  if (localX >= -halfW && localX <= halfW && localY >= -halfH && localY <= halfH) {
    return "body";
  }

  return null;
}

/**
 * Finds top-most layer at point (px, py) from layer stack (reverse order).
 */
export function hitTestLayers(
  px: number,
  py: number,
  layers: MemeLayer[],
): { layer: MemeLayer; handle: HandleType } | null {
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (!layer.visible || layer.locked) continue;
    const handle = getHandleAtPoint(px, py, layer);
    if (handle) {
      return { layer, handle };
    }
  }
  return null;
}

/**
 * Draws selection bounding box and interactive handles over the active layer.
 */
export function renderSelectionOverlay(
  ctx: CanvasRenderingContext2DLike,
  layer: MemeLayer,
): void {
  if (!layer.visible) return;

  ctx.save();
  ctx.translate(layer.x, layer.y);
  ctx.rotate((layer.rotation * Math.PI) / 180);
  ctx.scale(layer.scale, layer.scale);

  const halfW = layer.width / 2;
  const halfH = layer.height / 2;

  // Bounding rect
  ctx.strokeStyle = "#f97316"; // imbrgr ember accent
  ctx.lineWidth = 2 / layer.scale;
  ctx.strokeRect(-halfW, -halfH, layer.width, layer.height);

  // Rotation stem & knob
  const stemY = -halfH - 28;
  ctx.beginPath();
  ctx.moveTo(0, -halfH);
  ctx.lineTo(0, stemY);
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 2 / layer.scale;
  ctx.stroke();

  // Rotation circle
  ctx.beginPath();
  ctx.arc(0, stemY, 7 / layer.scale, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "#f97316";
  ctx.lineWidth = 2 / layer.scale;
  ctx.stroke();

  // Corner resize handles
  const corners = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [-halfW, halfH],
    [halfW, halfH],
  ];

  const handleSize = 10 / layer.scale;
  for (const [cx, cy] of corners) {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2 / layer.scale;
    ctx.strokeRect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
  }

  ctx.restore();
}

/**
 * Immutable layer state updates.
 */
export function addLayer(state: MemeCanvasState, layer: MemeLayer): MemeCanvasState {
  return {
    ...state,
    layers: [...state.layers, layer],
    selectedLayerId: layer.id,
  };
}

export function updateLayer<T extends MemeLayer>(
  state: MemeCanvasState,
  id: string,
  patch: Partial<T>,
): MemeCanvasState {
  return {
    ...state,
    layers: state.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as MemeLayer) : l)),
  };
}

export function removeLayer(state: MemeCanvasState, id: string): MemeCanvasState {
  const nextLayers = state.layers.filter((l) => l.id !== id);
  const nextSelected =
    state.selectedLayerId === id
      ? nextLayers.length > 0
        ? nextLayers[nextLayers.length - 1].id
        : null
      : state.selectedLayerId;

  return {
    ...state,
    layers: nextLayers,
    selectedLayerId: nextSelected,
  };
}

export function duplicateLayer(state: MemeCanvasState, id: string): MemeCanvasState {
  const target = state.layers.find((l) => l.id === id);
  if (!target) return state;

  const clone: MemeLayer = {
    ...target,
    id: createLayerId("copy"),
    name: `${target.name} (Copy)`,
    x: target.x + 20,
    y: target.y + 20,
  };

  const idx = state.layers.findIndex((l) => l.id === id);
  const nextLayers = [...state.layers];
  nextLayers.splice(idx + 1, 0, clone);

  return {
    ...state,
    layers: nextLayers,
    selectedLayerId: clone.id,
  };
}

export function reorderLayer(
  state: MemeCanvasState,
  id: string,
  direction: "up" | "down" | "top" | "bottom",
): MemeCanvasState {
  const idx = state.layers.findIndex((l) => l.id === id);
  if (idx < 0) return state;

  const layers = [...state.layers];
  const [item] = layers.splice(idx, 1);

  if (direction === "top") {
    layers.push(item);
  } else if (direction === "bottom") {
    layers.unshift(item);
  } else if (direction === "up") {
    const nextIdx = Math.min(layers.length, idx + 1);
    layers.splice(nextIdx, 0, item);
  } else if (direction === "down") {
    const nextIdx = Math.max(0, idx - 1);
    layers.splice(nextIdx, 0, item);
  }

  return {
    ...state,
    layers,
  };
}

export function toggleLockLayer(state: MemeCanvasState, id: string): MemeCanvasState {
  return {
    ...state,
    layers: state.layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l)),
  };
}

export function toggleHideLayer(state: MemeCanvasState, id: string): MemeCanvasState {
  return {
    ...state,
    layers: state.layers.map((l) => (l.id === id ? { ...l, visible: !l.visible } : l)),
  };
}

/**
 * Pure file size estimator for live preview in UI.
 */
export function estimateExportSize(
  width: number,
  height: number,
  format: "png" | "jpeg" | "webp",
  quality: number,
  scale = 1,
): number {
  const totalPixels = width * scale * (height * scale);
  const qRatio = Math.max(0.4, Math.min(1, quality / 100));

  if (format === "png") {
    // Lossless PNG: ~0.55 bytes per pixel on typical graphic/meme content
    return Math.round(totalPixels * 0.55);
  }

  if (format === "jpeg") {
    // JPEG: ~0.14 bytes per pixel at 80% quality
    return Math.round(totalPixels * 0.16 * qRatio);
  }

  if (format === "webp") {
    // WebP: ~25% more compact than JPEG
    return Math.round(totalPixels * 0.12 * qRatio);
  }

  return Math.round(totalPixels * 0.5);
}

/**
 * Pure Undo / Redo history state tracker.
 */
export interface HistoryManager<T> {
  past: T[];
  present: T;
  future: T[];
}

export function initHistory<T>(initial: T): HistoryManager<T> {
  return {
    past: [],
    present: initial,
    future: [],
  };
}

export function recordHistory<T>(
  history: HistoryManager<T>,
  next: T,
  maxHistory = 30,
): HistoryManager<T> {
  const newPast = [...history.past, history.present];
  if (newPast.length > maxHistory) {
    newPast.shift();
  }
  return {
    past: newPast,
    present: next,
    future: [],
  };
}

export function undoHistory<T>(history: HistoryManager<T>): HistoryManager<T> {
  if (history.past.length === 0) return history;
  const previous = history.past[history.past.length - 1];
  const newPast = history.past.slice(0, history.past.length - 1);
  return {
    past: newPast,
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoHistory<T>(history: HistoryManager<T>): HistoryManager<T> {
  if (history.future.length === 0) return history;
  const next = history.future[0];
  const newFuture = history.future.slice(1);
  return {
    past: [...history.past, history.present],
    present: next,
    future: newFuture,
  };
}
