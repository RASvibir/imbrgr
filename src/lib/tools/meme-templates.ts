/**
 * Original SVG meme templates for imbrgr Meme Maker.
 * 100% self-contained SVG compositions (no external requests or copyrighted material).
 */

import type { MemeAspect, MemeLayer } from "./meme-render";
import { MEME_FONTS } from "./meme-render";

export interface MemeTemplate {
  id: string;
  name: string;
  aspect: MemeAspect;
  description: string;
  svgDataUrl: string;
  defaultLayers: MemeLayer[];
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
}

// 1. Two Buttons Template (800x800)
const SVG_TWO_BUTTONS = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1e1b18"/>
      <stop offset="100%" stop-color="#12100e"/>
    </linearGradient>
    <radialGradient id="btnGlow1" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#f87171"/>
      <stop offset="70%" stop-color="#dc2626"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </radialGradient>
    <radialGradient id="btnGlow2" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#60a5fa"/>
      <stop offset="70%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e40af"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bgGrad)"/>
  
  <!-- Console Base -->
  <polygon points="60,340 740,340 780,520 20,520" fill="#2d2824" stroke="#4a423b" stroke-width="6"/>
  <rect x="20" y="520" width="760" height="240" fill="#1c1816" stroke="#4a423b" stroke-width="6"/>
  
  <!-- Left Button (Red) -->
  <ellipse cx="270" cy="430" rx="140" ry="60" fill="#7f1d1d"/>
  <ellipse cx="270" cy="415" rx="130" ry="50" fill="url(#btnGlow1)"/>
  <ellipse cx="260" cy="405" rx="90" ry="30" fill="#fca5a5" opacity="0.45"/>
  <text x="270" y="423" font-family="system-ui, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle">OPTION A</text>

  <!-- Right Button (Blue) -->
  <ellipse cx="530" cy="430" rx="140" ry="60" fill="#1e3a8a"/>
  <ellipse cx="530" cy="415" rx="130" ry="50" fill="url(#btnGlow2)"/>
  <ellipse cx="520" cy="405" rx="90" ry="30" fill="#93c5fd" opacity="0.45"/>
  <text x="530" y="423" font-family="system-ui, sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle">OPTION B</text>

  <!-- Sweating Character at bottom -->
  <circle cx="400" cy="740" r="160" fill="#fbbf24" stroke="#d97706" stroke-width="8"/>
  <!-- Sweat drop -->
  <path d="M 470 650 C 470 625 488 610 488 610 C 488 610 506 625 506 650 A 18 18 0 1 1 470 650 Z" fill="#60a5fa"/>
  <!-- Nervous eyebrow and furrow -->
  <path d="M 330 670 Q 365 650 395 670" stroke="#78350f" stroke-width="8" stroke-linecap="round" fill="none"/>
  <path d="M 405 670 Q 435 650 470 670" stroke="#78350f" stroke-width="8" stroke-linecap="round" fill="none"/>
</svg>
`;

// 2. Approval Matrix (Two Stacked Rows: Disapprove vs Approve) (800x800)
const SVG_APPROVAL_MATRIX = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <!-- Top Row (Disapproval) -->
  <rect x="0" y="0" width="800" height="396" fill="#1c1816"/>
  <rect x="0" y="0" width="340" height="396" fill="#7f1d1d" opacity="0.2"/>
  <line x1="340" y1="0" x2="340" y2="396" stroke="#3d3530" stroke-width="6"/>
  <!-- Reject icon & face silhouette -->
  <circle cx="170" cy="198" r="80" fill="#ef4444" opacity="0.85"/>
  <path d="M 130 158 L 210 238 M 210 158 L 130 238" stroke="#ffffff" stroke-width="16" stroke-linecap="round"/>

  <!-- Divider -->
  <line x1="0" y1="400" x2="800" y2="400" stroke="#f97316" stroke-width="8"/>

  <!-- Bottom Row (Approval) -->
  <rect x="0" y="404" width="800" height="396" fill="#141210"/>
  <rect x="0" y="404" width="340" height="396" fill="#14532d" opacity="0.2"/>
  <line x1="340" y1="404" x2="340" y2="800" stroke="#3d3530" stroke-width="6"/>
  <!-- Approve icon & face silhouette -->
  <circle cx="170" cy="602" r="80" fill="#22c55e" opacity="0.85"/>
  <path d="M 130 600 L 160 635 L 215 565" stroke="#ffffff" stroke-width="16" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
</svg>
`;

// 3. Trade Offer (800x800)
const SVG_TRADE_OFFER = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <radialGradient id="traderGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fb923c" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#141210" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="#141210"/>
  <rect width="800" height="800" fill="url(#traderGlow)"/>

  <!-- Header Banner -->
  <rect x="40" y="30" width="720" height="90" rx="16" fill="#ea580c"/>
  <text x="400" y="88" font-family="Impact, sans-serif" font-size="44" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="2">TRADE OFFER</text>

  <!-- Left Card: I RECEIVE -->
  <rect x="50" y="160" width="330" height="580" rx="20" fill="#1c1816" stroke="#3d3530" stroke-width="4"/>
  <rect x="60" y="170" width="310" height="60" rx="12" fill="#78350f"/>
  <text x="215" y="212" font-family="Impact, sans-serif" font-size="30" fill="#fbbf24" text-anchor="middle">I RECEIVE:</text>

  <!-- Right Card: YOU RECEIVE -->
  <rect x="420" y="160" width="330" height="580" rx="20" fill="#1c1816" stroke="#3d3530" stroke-width="4"/>
  <rect x="430" y="170" width="310" height="60" rx="12" fill="#1e3a8a"/>
  <text x="585" y="212" font-family="Impact, sans-serif" font-size="30" fill="#93c5fd" text-anchor="middle">YOU RECEIVE:</text>
</svg>
`;

// 4. Galaxy Brain / Expansion (800x800)
const SVG_EXPANDING_BRAIN = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <rect width="800" height="800" fill="#0f0d0c"/>
  <!-- Row 1 -->
  <rect x="10" y="10" width="460" height="180" rx="8" fill="#1c1816" stroke="#3d3530" stroke-width="3"/>
  <rect x="480" y="10" width="310" height="180" rx="8" fill="#1e1b18" stroke="#3d3530" stroke-width="3"/>
  <circle cx="635" cy="100" r="40" fill="#524840"/>
  <text x="635" y="106" font-family="sans-serif" font-size="28" fill="#c4b5a8" text-anchor="middle">Normal</text>

  <!-- Row 2 -->
  <rect x="10" y="205" width="460" height="180" rx="8" fill="#1c1816" stroke="#3d3530" stroke-width="3"/>
  <rect x="480" y="205" width="310" height="180" rx="8" fill="#1e2230" stroke="#3b82f6" stroke-width="3"/>
  <circle cx="635" cy="295" r="50" fill="#2563eb" opacity="0.6"/>
  <circle cx="635" cy="295" r="30" fill="#93c5fd"/>

  <!-- Row 3 -->
  <rect x="10" y="400" width="460" height="180" rx="8" fill="#1c1816" stroke="#3d3530" stroke-width="3"/>
  <rect x="480" y="400" width="310" height="180" rx="8" fill="#2a1630" stroke="#a855f7" stroke-width="3"/>
  <circle cx="635" cy="490" r="60" fill="#a855f7" opacity="0.7"/>
  <path d="M 590 490 L 680 490 M 635 445 L 635 535 M 605 460 L 665 520 M 605 520 L 665 460" stroke="#fdf4ff" stroke-width="4"/>

  <!-- Row 4 -->
  <rect x="10" y="595" width="460" height="195" rx="8" fill="#1c1816" stroke="#3d3530" stroke-width="3"/>
  <rect x="480" y="595" width="310" height="195" rx="8" fill="#30150a" stroke="#f97316" stroke-width="4"/>
  <circle cx="635" cy="692" r="75" fill="#f97316" opacity="0.8"/>
  <circle cx="635" cy="692" r="45" fill="#fbbf24"/>
  <circle cx="635" cy="692" r="20" fill="#ffffff"/>
</svg>
`;

// 5. Fire & Smile (800x800)
const SVG_FIRE_SMILE = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <radialGradient id="fireBurst" cx="50%" cy="80%" r="70%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="30%" stop-color="#f97316"/>
      <stop offset="70%" stop-color="#b91c1c"/>
      <stop offset="100%" stop-color="#141210"/>
    </radialGradient>
  </defs>
  <rect width="800" height="800" fill="url(#fireBurst)"/>

  <!-- Grill flames -->
  <path d="M 0 550 Q 150 420 300 560 Q 450 380 600 540 Q 720 400 800 580 L 800 800 L 0 800 Z" fill="#ea580c" opacity="0.8"/>
  <path d="M 0 620 Q 200 480 400 620 Q 600 460 800 640 L 800 800 L 0 800 Z" fill="#fbbf24" opacity="0.9"/>

  <!-- Smirking Figure in lower-left corner -->
  <circle cx="180" cy="660" r="140" fill="#fed7aa" stroke="#c2410c" stroke-width="8"/>
  <!-- Eyes looking sideways at camera -->
  <ellipse cx="140" cy="630" rx="14" ry="18" fill="#ffffff" stroke="#1c1917" stroke-width="4"/>
  <circle cx="146" cy="630" r="7" fill="#1c1917"/>
  <ellipse cx="200" cy="630" rx="14" ry="18" fill="#ffffff" stroke="#1c1917" stroke-width="4"/>
  <circle cx="206" cy="630" r="7" fill="#1c1917"/>
  <!-- Sly smirk -->
  <path d="M 140 700 Q 185 735 225 690" stroke="#1c1917" stroke-width="6" stroke-linecap="round" fill="none"/>
</svg>
`;

// 6. Blank Classic High-Contrast Card (800x800)
const SVG_BLANK_CARD = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
  <defs>
    <linearGradient id="blankGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#241d19"/>
      <stop offset="100%" stop-color="#141210"/>
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#blankGrad)"/>
  <rect x="24" y="24" width="752" height="752" rx="24" fill="none" stroke="#3d3530" stroke-width="4" stroke-dasharray="12 12"/>
  <circle cx="400" cy="400" r="90" fill="#f97316" opacity="0.1"/>
  <text x="400" y="415" font-family="system-ui, sans-serif" font-size="48" fill="#fb923c" font-weight="900" text-anchor="middle">imbrgr meme</text>
</svg>
`;

export const MEME_TEMPLATES: MemeTemplate[] = [
  {
    id: "two-buttons",
    name: "Two Buttons",
    aspect: "1:1",
    description: "Tough choice between Option A and Option B",
    svgDataUrl: svgToDataUrl(SVG_TWO_BUTTONS),
    defaultLayers: [
      {
        id: "tb-text-top",
        type: "text",
        name: "Top Choice",
        x: 400,
        y: 80,
        width: 720,
        height: 80,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "WHEN YOU HAVE TO CHOOSE",
        fontFamily: MEME_FONTS[0].stack,
        fontSize: 42,
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
      },
    ],
  },
  {
    id: "approval-matrix",
    name: "Approval / Disapproval",
    aspect: "1:1",
    description: "Compare what you dislike vs what you love",
    svgDataUrl: svgToDataUrl(SVG_APPROVAL_MATRIX),
    defaultLayers: [
      {
        id: "am-text-reject",
        type: "text",
        name: "Disapproval Text",
        x: 560,
        y: 200,
        width: 420,
        height: 120,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "DOING THINGS THE HARD WAY",
        fontFamily: MEME_FONTS[0].stack,
        fontSize: 34,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 4,
        shadow: true,
        shadowColor: "rgba(0,0,0,0.8)",
        shadowBlur: 4,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        align: "center",
        allCaps: true,
        lineHeight: 1.15,
      },
      {
        id: "am-text-approve",
        type: "text",
        name: "Approval Text",
        x: 560,
        y: 600,
        width: 420,
        height: 120,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "COOKING MEMES ON IMBRGR",
        fontFamily: MEME_FONTS[0].stack,
        fontSize: 34,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 4,
        shadow: true,
        shadowColor: "rgba(0,0,0,0.8)",
        shadowBlur: 4,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        align: "center",
        allCaps: true,
        lineHeight: 1.15,
      },
    ],
  },
  {
    id: "trade-offer",
    name: "Trade Offer",
    aspect: "1:1",
    description: "The classic negotiable deal meme",
    svgDataUrl: svgToDataUrl(SVG_TRADE_OFFER),
    defaultLayers: [
      {
        id: "trade-left",
        type: "text",
        name: "I Receive Text",
        x: 215,
        y: 400,
        width: 290,
        height: 200,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "YOUR FLAME-GRILLED ATTENTION",
        fontFamily: MEME_FONTS[0].stack,
        fontSize: 28,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 4,
        shadow: true,
        shadowColor: "rgba(0,0,0,0.8)",
        shadowBlur: 4,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        align: "center",
        allCaps: true,
        lineHeight: 1.15,
      },
      {
        id: "trade-right",
        type: "text",
        name: "You Receive Text",
        x: 585,
        y: 400,
        width: 290,
        height: 200,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "FRESH HOT MEMES DAILY",
        fontFamily: MEME_FONTS[0].stack,
        fontSize: 28,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 4,
        shadow: true,
        shadowColor: "rgba(0,0,0,0.8)",
        shadowBlur: 4,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        align: "center",
        allCaps: true,
        lineHeight: 1.15,
      },
    ],
  },
  {
    id: "expanding-brain",
    name: "Galaxy Brain",
    aspect: "1:1",
    description: "Escalating levels of enlightenment",
    svgDataUrl: svgToDataUrl(SVG_EXPANDING_BRAIN),
    defaultLayers: [
      {
        id: "brain-1",
        type: "text",
        name: "Stage 1",
        x: 240,
        y: 100,
        width: 420,
        height: 80,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "Plain image editor",
        fontFamily: MEME_FONTS[1].stack,
        fontSize: 22,
        fillColor: "#ffffff",
        strokeColor: "#000000",
        strokeWidth: 3,
        shadow: true,
        shadowColor: "rgba(0,0,0,0.8)",
        shadowBlur: 2,
        shadowOffsetX: 1,
        shadowOffsetY: 1,
        align: "center",
        allCaps: false,
        lineHeight: 1.15,
      },
      {
        id: "brain-4",
        type: "text",
        name: "Stage 4",
        x: 240,
        y: 692,
        width: 420,
        height: 80,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "Custom imbrgr meme suite",
        fontFamily: MEME_FONTS[1].stack,
        fontSize: 22,
        fillColor: "#fbbf24",
        strokeColor: "#78350f",
        strokeWidth: 3,
        shadow: true,
        shadowColor: "rgba(0,0,0,0.8)",
        shadowBlur: 4,
        shadowOffsetX: 1,
        shadowOffsetY: 1,
        align: "center",
        allCaps: false,
        lineHeight: 1.15,
      },
    ],
  },
  {
    id: "fire-smile",
    name: "Grill Master",
    aspect: "1:1",
    description: "The mischievous flame smirk",
    svgDataUrl: svgToDataUrl(SVG_FIRE_SMILE),
    defaultLayers: [
      {
        id: "fs-top",
        type: "text",
        name: "Top Text",
        x: 400,
        y: 80,
        width: 720,
        height: 80,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "WATCHING THE CODE COMPILE",
        fontFamily: MEME_FONTS[0].stack,
        fontSize: 44,
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
      },
      {
        id: "fs-bottom",
        type: "text",
        name: "Bottom Text",
        x: 400,
        y: 720,
        width: 720,
        height: 80,
        rotation: 0,
        scale: 1,
        opacity: 1,
        locked: false,
        visible: true,
        text: "ON THE VERY FIRST TRY",
        fontFamily: MEME_FONTS[0].stack,
        fontSize: 44,
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
      },
    ],
  },
  {
    id: "classic-blank",
    name: "Classic Blank",
    aspect: "1:1",
    description: "High-contrast clean canvas with classic top & bottom text",
    svgDataUrl: svgToDataUrl(SVG_BLANK_CARD),
    defaultLayers: [
      {
        id: "cb-top",
        type: "text",
        name: "Top Text",
        x: 400,
        y: 80,
        width: 720,
        height: 80,
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
      },
      {
        id: "cb-bottom",
        type: "text",
        name: "Bottom Text",
        x: 400,
        y: 720,
        width: 720,
        height: 80,
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
      },
    ],
  },
];
