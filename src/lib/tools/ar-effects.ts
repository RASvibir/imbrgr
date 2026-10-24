/**
 * Procedural canvas AR effects for imbrgr.
 * All effects are drawn purely with Canvas2D paths, gradients, and math.
 * No external images or copyrighted assets are used.
 * Deterministic: no Math.random() is used; animations are driven by timeSec.
 */

import {
  type HeadPose,
  type Landmark,
  type Point2D,
  getFreckleOffsets,
} from "./ar-geometry";
import { applyFunFilter, isFunFilter } from "../fun-filters";

export type ArEffectId =
  | "burger-hat"
  | "burger-frame"
  | "sesame-freckles"
  | "ketchup-mustard"
  | "cheese-melt"
  | "flame-halo"
  | "sunglasses"
  | "pixel-mask"
  | "retro-hud"
  | "fun-filter";

export type ArEffectMeta = {
  id: ArEffectId;
  label: string;
  emoji: string;
  description: string;
  defaultIntensity: number;
};

export const AR_EFFECTS: ArEffectMeta[] = [
  {
    id: "burger-hat",
    label: "Burger Hat",
    emoji: "🍔",
    description: "Towering double patty burger perched on your head.",
    defaultIntensity: 1.0,
  },
  {
    id: "burger-frame",
    label: "Burger Frame",
    emoji: "🥯",
    description: "Toasted sesame bun framing your face like a patty.",
    defaultIntensity: 0.9,
  },
  {
    id: "cheese-melt",
    label: "Cheese Drip",
    emoji: "🧀",
    description: "Gooey melted cheddar dripping down your forehead.",
    defaultIntensity: 0.85,
  },
  {
    id: "ketchup-mustard",
    label: "Condiment 'Stache",
    emoji: "🌭",
    description: "Curled ketchup and mustard dollop mustache.",
    defaultIntensity: 1.0,
  },
  {
    id: "sesame-freckles",
    label: "Sesame Freckles",
    emoji: "🌾",
    description: "Toasted sesame seed freckles across your cheeks.",
    defaultIntensity: 0.8,
  },
  {
    id: "flame-halo",
    label: "Flame Halo",
    emoji: "🔥",
    description: "Flickering grill flame halo hovering overhead.",
    defaultIntensity: 0.9,
  },
  {
    id: "sunglasses",
    label: "Ember Shades",
    emoji: "🕶️",
    description: "Cool burger-joint retro tortoiseshell sunglasses.",
    defaultIntensity: 1.0,
  },
  {
    id: "retro-hud",
    label: "Patty Radar HUD",
    emoji: "🎯",
    description: "Cyber arcade targeting HUD locking onto face heat.",
    defaultIntensity: 0.95,
  },
  {
    id: "pixel-mask",
    label: "Pixel Patty",
    emoji: "👾",
    description: "Chunky 8-bit mosaic pixelation over your face.",
    defaultIntensity: 0.75,
  },
  {
    id: "fun-filter",
    label: "Grill Vision",
    emoji: "⚡",
    description: "Retro fun color grade inspired by flame-grilled patties.",
    defaultIntensity: 0.8,
  },
];

export type EffectRenderContext = {
  ctx: CanvasRenderingContext2D;
  pose: HeadPose;
  landmarks: Landmark[];
  canvasWidth: number;
  canvasHeight: number;
  mirror: boolean;
  intensity: number;
  timeSec: number;
  funFilterId?: string;
};

// ==========================================
// 1. BURGER HAT EFFECT
// ==========================================
export function drawBurgerHat(rc: EffectRenderContext): void {
  const { ctx, pose, intensity } = rc;
  if (intensity <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, intensity));

  // Anchor: top center of forehead, offset upward
  const anchorX = pose.forehead.x;
  const anchorY = pose.forehead.y - pose.scale * 0.12;
  const size = pose.scale * 0.95;

  ctx.translate(anchorX, anchorY);
  ctx.rotate(pose.roll);

  const bw = size; // burger width
  const bh = size * 0.65; // burger height

  // 1. Bottom Bun
  ctx.fillStyle = "#c26d1c";
  ctx.beginPath();
  ctx.roundRect(-bw * 0.42, 0, bw * 0.84, bh * 0.22, [6, 6, 16, 16]);
  ctx.fill();

  // 2. Bottom Patty
  ctx.fillStyle = "#4a2311";
  ctx.beginPath();
  ctx.roundRect(-bw * 0.45, -bh * 0.14, bw * 0.9, bh * 0.16, [4, 4, 4, 4]);
  ctx.fill();

  // 3. Cheese layer with dripping corner
  ctx.fillStyle = "#f59e0b";
  ctx.beginPath();
  ctx.moveTo(-bw * 0.44, -bh * 0.13);
  ctx.lineTo(bw * 0.44, -bh * 0.13);
  ctx.lineTo(bw * 0.38, -bh * 0.04);
  ctx.lineTo(bw * 0.2, -bh * 0.08);
  ctx.lineTo(bw * 0.05, 0.05 * bh); // drip
  ctx.lineTo(-bw * 0.1, -bh * 0.08);
  ctx.lineTo(-bw * 0.32, -bh * 0.02);
  ctx.closePath();
  ctx.fill();

  // 4. Lettuce ruffles
  ctx.fillStyle = "#22c55e";
  ctx.beginPath();
  const lettuceSteps = 8;
  const lw = bw * 0.96;
  ctx.moveTo(-lw / 2, -bh * 0.18);
  for (let i = 0; i <= lettuceSteps; i++) {
    const lx = -lw / 2 + (i / lettuceSteps) * lw;
    const ly = -bh * 0.18 + (i % 2 === 0 ? -bh * 0.06 : bh * 0.04);
    ctx.lineTo(lx, ly);
  }
  ctx.lineTo(lw / 2, -bh * 0.12);
  ctx.lineTo(-lw / 2, -bh * 0.12);
  ctx.closePath();
  ctx.fill();

  // 5. Top Bun Dome
  const topBunGrad = ctx.createLinearGradient(0, -bh * 0.75, 0, -bh * 0.18);
  topBunGrad.addColorStop(0, "#f59e0b");
  topBunGrad.addColorStop(0.3, "#d97706");
  topBunGrad.addColorStop(1, "#92400e");
  ctx.fillStyle = topBunGrad;

  ctx.beginPath();
  ctx.ellipse(0, -bh * 0.22, bw * 0.46, bh * 0.48, 0, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();

  // Highlight sheen on top bun
  ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
  ctx.beginPath();
  ctx.ellipse(-bw * 0.12, -bh * 0.52, bw * 0.2, bh * 0.08, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Sesame seeds on top bun
  ctx.fillStyle = "#fef3c7";
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 1;
  const seedPositions = [
    [-0.24, -0.48, 0.4],
    [-0.1, -0.58, -0.2],
    [0.08, -0.56, 0.3],
    [0.22, -0.46, -0.4],
    [-0.18, -0.36, -0.3],
    [0.02, -0.4, 0.1],
    [0.18, -0.34, 0.5],
    [-0.32, -0.3, 0.6],
    [0.28, -0.28, -0.5],
  ];
  for (const [sx, sy, sr] of seedPositions) {
    ctx.save();
    ctx.translate(sx * bw, sy * bh);
    ctx.rotate(sr);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.025, size * 0.012, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ==========================================
// 2. BURGER BUN FACE FRAME
// ==========================================
export function drawBurgerFrame(rc: EffectRenderContext): void {
  const { ctx, pose, intensity } = rc;
  if (intensity <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, intensity * 0.95));

  ctx.translate(pose.center.x, pose.center.y);
  ctx.rotate(pose.roll);

  const radiusX = pose.scale * 0.68;
  const radiusY = pose.scale * 0.88;
  const thickness = pose.scale * 0.22;

  // Outer bun frame
  const frameGrad = ctx.createRadialGradient(0, 0, radiusX * 0.8, 0, 0, radiusX + thickness);
  frameGrad.addColorStop(0, "rgba(217, 119, 6, 0)");
  frameGrad.addColorStop(0.3, "rgba(217, 119, 6, 0.85)");
  frameGrad.addColorStop(0.7, "#b45309");
  frameGrad.addColorStop(1, "#78350f");

  ctx.lineWidth = thickness;
  ctx.strokeStyle = frameGrad;
  ctx.beginPath();
  ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Bottom bun arch shading
  ctx.strokeStyle = "rgba(120, 53, 15, 0.4)";
  ctx.lineWidth = thickness * 0.3;
  ctx.beginPath();
  ctx.ellipse(0, radiusY * 0.1, radiusX * 0.95, radiusY * 0.9, 0, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  // Sesame seeds scattered around the top arch of the frame
  ctx.fillStyle = "#fffbeb";
  ctx.strokeStyle = "#92400e";
  ctx.lineWidth = 1;
  const seedAngles = [-2.8, -2.4, -2.0, -1.6, -1.2, -0.8, -0.4];
  for (let i = 0; i < seedAngles.length; i++) {
    const ang = seedAngles[i];
    const r = radiusX + (i % 2 === 0 ? 4 : -4);
    const sx = Math.cos(ang) * r;
    const sy = Math.sin(ang) * radiusY;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang + Math.PI / 2);
    ctx.beginPath();
    ctx.ellipse(0, 0, pose.scale * 0.024, pose.scale * 0.012, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ==========================================
// 3. SESAME FRECKLES EFFECT
// ==========================================
export function drawSesameFreckles(rc: EffectRenderContext): void {
  const { ctx, pose, intensity } = rc;
  if (intensity <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, intensity * 0.9));

  const seeds = getFreckleOffsets();
  const seedLen = pose.eyeDistance * 0.07;
  const seedWid = pose.eyeDistance * 0.035;

  ctx.fillStyle = "#fffbeb";
  ctx.strokeStyle = "#b45309";
  ctx.lineWidth = 0.8;

  // Left cheek anchor (viewer left)
  const leftAnchor = pose.rightCheek;
  // Right cheek anchor (viewer right)
  const rightAnchor = pose.leftCheek;
  // Nose bridge
  const noseAnchor = pose.noseTip;

  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    let anchor: Point2D;
    let spreadX = pose.eyeDistance * 0.28;
    let spreadY = pose.eyeDistance * 0.18;

    if (i < 7) {
      anchor = leftAnchor;
    } else if (i < 14) {
      anchor = rightAnchor;
    } else {
      anchor = noseAnchor;
      spreadX = pose.eyeDistance * 0.15;
      spreadY = pose.eyeDistance * 0.12;
    }

    const px = anchor.x + s.u * spreadX;
    const py = anchor.y + s.v * spreadY - pose.eyeDistance * 0.15;

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(s.rotation + pose.roll);
    ctx.beginPath();
    ctx.ellipse(0, 0, seedLen * s.scale, seedWid * s.scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  ctx.restore();
}

// ==========================================
// 4. KETCHUP & MUSTARD MUSTACHE EFFECT
// ==========================================
export function drawKetchupMustard(rc: EffectRenderContext): void {
  const { ctx, pose, intensity } = rc;
  if (intensity <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, intensity));

  const mx = pose.mouthCenter.x;
  // Place slightly above upper lip
  const my = pose.mouthCenter.y - pose.scale * 0.09;
  const w = pose.mouthWidth * 1.5;

  ctx.translate(mx, my);
  ctx.rotate(pose.roll);

  // Ketchup mustache base (glossy crimson)
  ctx.lineWidth = pose.scale * 0.055;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#dc2626";

  ctx.beginPath();
  // Left curl (viewer left)
  ctx.moveTo(-w * 0.55, -w * 0.12);
  ctx.quadraticCurveTo(-w * 0.45, w * 0.08, -w * 0.25, 0);
  ctx.quadraticCurveTo(-w * 0.08, -w * 0.06, 0, 0);
  // Right curl (viewer right)
  ctx.quadraticCurveTo(w * 0.08, -w * 0.06, w * 0.25, 0);
  ctx.quadraticCurveTo(w * 0.45, w * 0.08, w * 0.55, -w * 0.12);
  ctx.stroke();

  // Ketchup glossy highlight
  ctx.lineWidth = pose.scale * 0.018;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
  ctx.beginPath();
  ctx.moveTo(-w * 0.48, -w * 0.08);
  ctx.quadraticCurveTo(-w * 0.35, w * 0.04, -w * 0.18, -w * 0.01);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(w * 0.18, -w * 0.01);
  ctx.quadraticCurveTo(w * 0.35, w * 0.04, w * 0.48, -w * 0.08);
  ctx.stroke();

  // Tangy Mustard Swirl (golden yellow wavy overlay)
  ctx.lineWidth = pose.scale * 0.035;
  ctx.strokeStyle = "#eab308";
  ctx.beginPath();
  ctx.moveTo(-w * 0.45, -w * 0.06);
  ctx.bezierCurveTo(-w * 0.3, w * 0.06, -w * 0.15, -w * 0.04, 0, w * 0.02);
  ctx.bezierCurveTo(w * 0.15, -w * 0.04, w * 0.3, w * 0.06, w * 0.45, -w * 0.06);
  ctx.stroke();

  // Squirt droplets at tips
  ctx.fillStyle = "#dc2626";
  ctx.beginPath();
  ctx.arc(-w * 0.58, -w * 0.15, pose.scale * 0.018, 0, Math.PI * 2);
  ctx.arc(w * 0.58, -w * 0.15, pose.scale * 0.018, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#eab308";
  ctx.beginPath();
  ctx.arc(-w * 0.5, -w * 0.18, pose.scale * 0.014, 0, Math.PI * 2);
  ctx.arc(w * 0.5, -w * 0.18, pose.scale * 0.014, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ==========================================
// 5. CHEESE MELT DRIP OVER FOREHEAD
// ==========================================
export function drawCheeseMelt(rc: EffectRenderContext): void {
  const { ctx, pose, intensity, timeSec } = rc;
  if (intensity <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, intensity));

  const fx = pose.forehead.x;
  const fy = pose.forehead.y;
  const w = pose.scale * 1.1;

  ctx.translate(fx, fy);
  ctx.rotate(pose.roll);

  // Melt blanket and drips
  const cheeseGrad = ctx.createLinearGradient(0, -w * 0.25, 0, w * 0.4);
  cheeseGrad.addColorStop(0, "#f59e0b");
  cheeseGrad.addColorStop(0.6, "#fbbf24");
  cheeseGrad.addColorStop(1, "#f59e0b");

  ctx.fillStyle = cheeseGrad;
  ctx.beginPath();

  // Top baseline arching across top of forehead
  ctx.moveTo(-w * 0.55, -w * 0.22);
  ctx.lineTo(w * 0.55, -w * 0.22);

  // Bottom edge with 6 dripping gooey droplets
  const drips = [
    { x: 0.48, len: 0.12 },
    { x: 0.32, len: 0.32 },
    { x: 0.14, len: 0.18 },
    { x: -0.05, len: 0.38 },
    { x: -0.25, len: 0.22 },
    { x: -0.44, len: 0.30 },
  ];

  ctx.lineTo(w * 0.52, -w * 0.1);
  for (let i = 0; i < drips.length; i++) {
    const d = drips[i];
    // subtle animated jiggle
    const wobble = Math.sin(timeSec * 2.5 + i * 1.2) * 0.02 * w;
    const dripLen = (d.len * w + wobble) * intensity;
    const dx = d.x * w;

    ctx.lineTo(dx + w * 0.05, -w * 0.08);
    // Draw rounded bulb at tip of drip
    ctx.bezierCurveTo(
      dx + w * 0.04,
      dripLen * 0.7,
      dx + w * 0.03,
      dripLen,
      dx,
      dripLen,
    );
    ctx.bezierCurveTo(
      dx - w * 0.03,
      dripLen,
      dx - w * 0.04,
      dripLen * 0.7,
      dx - w * 0.05,
      -w * 0.08,
    );
  }
  ctx.lineTo(-w * 0.52, -w * 0.1);
  ctx.closePath();
  ctx.fill();

  // Specular glossy dots on drip tips
  ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
  for (let i = 0; i < drips.length; i++) {
    const d = drips[i];
    const wobble = Math.sin(timeSec * 2.5 + i * 1.2) * 0.02 * w;
    const dripLen = (d.len * w + wobble) * intensity;
    const dx = d.x * w;
    ctx.beginPath();
    ctx.arc(dx + 2, dripLen - 4, Math.max(1, w * 0.015), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ==========================================
// 6. FLAME HALO EFFECT
// ==========================================
export function drawFlameHalo(rc: EffectRenderContext): void {
  const { ctx, pose, intensity, timeSec } = rc;
  if (intensity <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, intensity));

  const hx = pose.forehead.x;
  const hy = pose.forehead.y - pose.scale * 0.35;
  const radius = pose.scale * 0.55;

  ctx.translate(hx, hy);
  ctx.rotate(pose.roll);

  // Warm halo glow
  const glow = ctx.createRadialGradient(0, 0, radius * 0.5, 0, 0, radius * 1.3);
  glow.addColorStop(0, "rgba(251, 146, 60, 0.25)");
  glow.addColorStop(0.7, "rgba(234, 88, 12, 0.15)");
  glow.addColorStop(1, "rgba(234, 88, 12, 0)");
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, radius * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Flame tongues around ring
  const flameCount = 12;
  for (let i = 0; i < flameCount; i++) {
    const angle = (i / flameCount) * Math.PI * 2;
    const animPhase = timeSec * 5 + i * 1.7;
    const flicker = Math.sin(animPhase) * radius * 0.12;
    const flameH = (radius * 0.28 + flicker) * intensity;

    const bx = Math.cos(angle) * radius;
    const by = Math.sin(angle) * (radius * 0.35); // elliptical perspective

    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(angle + Math.PI / 2);

    // Flame tongue
    const flameGrad = ctx.createLinearGradient(0, 0, 0, -flameH);
    flameGrad.addColorStop(0, "#ea580c");
    flameGrad.addColorStop(0.4, "#f97316");
    flameGrad.addColorStop(0.8, "#facc15");
    flameGrad.addColorStop(1, "#fef08a");

    ctx.fillStyle = flameGrad;
    ctx.beginPath();
    ctx.moveTo(-radius * 0.08, 0);
    ctx.quadraticCurveTo(-radius * 0.06, -flameH * 0.6, 0, -flameH);
    ctx.quadraticCurveTo(radius * 0.06, -flameH * 0.6, radius * 0.08, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Floating embers
  ctx.fillStyle = "#fef08a";
  for (let j = 0; j < 6; j++) {
    const emberT = (timeSec * 0.8 + j * 0.35) % 1.0;
    const emberAngle = j * 1.1;
    const emberR = radius * (0.8 + emberT * 0.5);
    const ex = Math.cos(emberAngle) * emberR;
    const ey = Math.sin(emberAngle) * (radius * 0.3) - emberT * radius * 0.4;
    const alpha = (1 - emberT) * 0.8;
    ctx.fillStyle = `rgba(254, 240, 138, ${alpha})`;
    ctx.beginPath();
    ctx.arc(ex, ey, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

// ==========================================
// 7. RETRO EMBER SUNGLASSES
// ==========================================
export function drawSunglasses(rc: EffectRenderContext): void {
  const { ctx, pose, intensity } = rc;
  if (intensity <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, intensity));

  const cx = pose.center.x;
  const cy = pose.center.y;
  const span = pose.eyeDistance * 1.6;

  ctx.translate(cx, cy);
  ctx.rotate(pose.roll);

  const lw = span * 0.42; // lens width
  const lh = span * 0.34; // lens height
  const bridgeW = span * 0.14;

  // Frame outer border
  ctx.fillStyle = "#1c1917";
  ctx.strokeStyle = "#d97706";
  ctx.lineWidth = 2.5;

  // Left lens frame (viewer left)
  ctx.beginPath();
  ctx.roundRect(-bridgeW / 2 - lw, -lh * 0.4, lw, lh, [10, 10, 24, 24]);
  ctx.fill();
  ctx.stroke();

  // Right lens frame (viewer right)
  ctx.beginPath();
  ctx.roundRect(bridgeW / 2, -lh * 0.4, lw, lh, [10, 10, 24, 24]);
  ctx.fill();
  ctx.stroke();

  // Bridge
  ctx.fillRect(-bridgeW / 2, -lh * 0.32, bridgeW, lh * 0.18);
  ctx.strokeRect(-bridgeW / 2, -lh * 0.32, bridgeW, lh * 0.18);

  // Tinted dark amber lenses
  const lensGrad = ctx.createLinearGradient(0, -lh * 0.4, 0, lh * 0.6);
  lensGrad.addColorStop(0, "rgba(24, 24, 27, 0.95)");
  lensGrad.addColorStop(0.6, "rgba(69, 26, 3, 0.92)");
  lensGrad.addColorStop(1, "rgba(180, 83, 9, 0.85)");

  ctx.fillStyle = lensGrad;
  ctx.beginPath();
  ctx.roundRect(-bridgeW / 2 - lw + 3, -lh * 0.4 + 3, lw - 6, lh - 6, [8, 8, 20, 20]);
  ctx.fill();

  ctx.beginPath();
  ctx.roundRect(bridgeW / 2 + 3, -lh * 0.4 + 3, lw - 6, lh - 6, [8, 8, 20, 20]);
  ctx.fill();

  // Glossy reflection diagonals across lenses
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  // Left lens glare
  ctx.moveTo(-bridgeW / 2 - lw * 0.8, -lh * 0.25);
  ctx.lineTo(-bridgeW / 2 - lw * 0.25, lh * 0.35);
  // Right lens glare
  ctx.moveTo(bridgeW / 2 + lw * 0.2, -lh * 0.25);
  ctx.lineTo(bridgeW / 2 + lw * 0.75, lh * 0.35);
  ctx.stroke();

  ctx.restore();
}

// ==========================================
// 8. PIXEL PATTY MASK
// ==========================================
export function drawPixelMask(rc: EffectRenderContext): void {
  const { ctx, pose, intensity, canvasWidth, canvasHeight } = rc;
  if (intensity <= 0) return;

  const b = pose.bounds;
  const pad = b.width * 0.15;
  const rx = Math.max(0, Math.floor(b.minX - pad));
  const ry = Math.max(0, Math.floor(b.minY - pad));
  const rw = Math.min(canvasWidth - rx, Math.ceil(b.width + pad * 2));
  const rh = Math.min(canvasHeight - ry, Math.ceil(b.height + pad * 2));

  if (rw <= 0 || rh <= 0) return;

  try {
    const imgData = ctx.getImageData(rx, ry, rw, rh);
    const d = imgData.data;
    // Block size from 8px to 32px based on intensity
    const blockSize = Math.max(6, Math.round(8 + intensity * 24));

    for (let by = 0; by < rh; by += blockSize) {
      for (let bx = 0; bx < rw; bx += blockSize) {
        // Average sample in block
        let sumR = 0;
        let sumG = 0;
        let sumB = 0;
        let count = 0;

        for (let py = 0; py < blockSize && by + py < rh; py++) {
          for (let px = 0; px < blockSize && bx + px < rw; px++) {
            const idx = ((by + py) * rw + (bx + px)) * 4;
            sumR += d[idx];
            sumG += d[idx + 1];
            sumB += d[idx + 2];
            count++;
          }
        }

        if (count === 0) continue;
        const avgR = (sumR / count) | 0;
        const avgG = (sumG / count) | 0;
        const avgB = (sumB / count) | 0;

        for (let py = 0; py < blockSize && by + py < rh; py++) {
          for (let px = 0; px < blockSize && bx + px < rw; px++) {
            const idx = ((by + py) * rw + (bx + px)) * 4;
            d[idx] = avgR;
            d[idx + 1] = avgG;
            d[idx + 2] = avgB;
          }
        }
      }
    }

    ctx.putImageData(imgData, rx, ry);
  } catch {
    // If canvas is tainted or cross-origin, graceful no-op
  }
}

// ==========================================
// 9. RETRO PATTY RADAR HUD
// ==========================================
export function drawRetroHud(rc: EffectRenderContext): void {
  const { ctx, pose, intensity, timeSec } = rc;
  if (intensity <= 0) return;

  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, intensity));

  const cx = pose.center.x;
  const cy = pose.center.y;
  const w = pose.scale * 1.25;
  const h = pose.scale * 1.5;

  ctx.translate(cx, cy);
  ctx.rotate(pose.roll);

  const themeColor = "#22c55e"; // Radar neon green
  const emberColor = "#f97316";

  ctx.strokeStyle = themeColor;
  ctx.lineWidth = 2.5;

  // Bracket corners
  const cornerLen = w * 0.18;
  const hw = w / 2;
  const hh = h / 2;

  // Top-Left
  ctx.beginPath();
  ctx.moveTo(-hw, -hh + cornerLen);
  ctx.lineTo(-hw, -hh);
  ctx.lineTo(-hw + cornerLen, -hh);
  ctx.stroke();

  // Top-Right
  ctx.beginPath();
  ctx.moveTo(hw, -hh + cornerLen);
  ctx.lineTo(hw, -hh);
  ctx.lineTo(hw - cornerLen, -hh);
  ctx.stroke();

  // Bottom-Left
  ctx.beginPath();
  ctx.moveTo(-hw, hh - cornerLen);
  ctx.lineTo(-hw, hh);
  ctx.lineTo(-hw + cornerLen, hh);
  ctx.stroke();

  // Bottom-Right
  ctx.beginPath();
  ctx.moveTo(hw, hh - cornerLen);
  ctx.lineTo(hw, hh);
  ctx.lineTo(hw - cornerLen, hh);
  ctx.stroke();

  // Center crosshairs on nose
  ctx.strokeStyle = emberColor;
  ctx.lineWidth = 1.5;
  const crossSize = w * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, crossSize, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-crossSize * 1.5, 0);
  ctx.lineTo(crossSize * 1.5, 0);
  ctx.moveTo(0, -crossSize * 1.5);
  ctx.lineTo(0, crossSize * 1.5);
  ctx.stroke();

  // HUD Telemetry readouts
  ctx.font = "bold 11px monospace";
  ctx.fillStyle = themeColor;
  ctx.fillText("TARGET: PATTY", -hw, -hh - 10);
  ctx.fillText("LOCK: 100%", hw - 65, -hh - 10);

  const heat = 420 + Math.floor(Math.sin(timeSec * 3) * 15);
  ctx.fillStyle = emberColor;
  ctx.fillText(`HEAT: ${heat}°F`, -hw, hh + 20);
  ctx.fillText("SPICE: MAX", hw - 70, hh + 20);

  ctx.restore();
}

// ==========================================
// 10. FUN FILTER BACKGROUND / FULL TINT
// ==========================================
export function drawFunFilterEffect(rc: EffectRenderContext): void {
  const { ctx, canvasWidth, canvasHeight, intensity, timeSec, funFilterId } = rc;
  if (intensity <= 0) return;

  const filterId = funFilterId && isFunFilter(funFilterId) ? funFilterId : "flame-grilled";
  try {
    const imgData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    applyFunFilter(imgData, filterId, { intensity, timeSec });
    ctx.putImageData(imgData, 0, 0);
  } catch {
    // Cross-origin fallback
  }
}

// ==========================================
// MASTER EFFECT DISPATCHER
// ==========================================
export function renderArEffect(effectId: ArEffectId, rc: EffectRenderContext): void {
  switch (effectId) {
    case "burger-hat":
      drawBurgerHat(rc);
      break;
    case "burger-frame":
      drawBurgerFrame(rc);
      break;
    case "sesame-freckles":
      drawSesameFreckles(rc);
      break;
    case "ketchup-mustard":
      drawKetchupMustard(rc);
      break;
    case "cheese-melt":
      drawCheeseMelt(rc);
      break;
    case "flame-halo":
      drawFlameHalo(rc);
      break;
    case "sunglasses":
      drawSunglasses(rc);
      break;
    case "pixel-mask":
      drawPixelMask(rc);
      break;
    case "retro-hud":
      drawRetroHud(rc);
      break;
    case "fun-filter":
      drawFunFilterEffect(rc);
      break;
  }
}
