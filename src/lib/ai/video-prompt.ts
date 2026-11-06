/**
 * Deterministic video-prompt quality helpers.
 * Used when LLM enhance is unavailable/skipped, and as structure checks for eval fixtures.
 */

import { normalizePromptText } from "@/lib/ai/prompt-heuristics";
import type { CameraMotion } from "@/lib/ai/video-provider";

/** Appended by buildCinematicVideoPrompt — favors free text→video models (stock/stills/cheap gen). */
export const VIDEO_QUALITY_SUFFIX =
  "smooth continuous motion, coherent subject, stable framing, high detail, clean composition";

export const VIDEO_NEGATIVE_CUES =
  "no watermark, no text overlay, no logo, no title card, no jitter, no morphing faces, no flicker, no cutaway";

/** Subject / scene motion — not camera moves. */
const MOTION_MARKERS =
  /\b(slow[\s-]?motion|motion|moves?|moving|sizzl\w*|steam\w*|dripp\w*|pour\w*|ris\w*|fall\w*|drift\w*|sway\w*|spin\w*|flow\w*|flicker\w*|pulse\w*|ripple\w*|spark\w*|flame\w*|smoke\w*|rain\w*|wind\w*|walk\w*|run\w*|fly\w*|float\w*|rotate\w*|turn\w*|swirl\w*|melt\w*|boil\w*|bubble\w*|paddl\w*|sear\w*|popp\w*)\b/i;

/**
 * Camera *moves* only. Framing/lens terms (wide, macro, aerial, close-up, establishing)
 * live in FRAMING_MARKERS so a single shared word cannot inflate both dimensions.
 */
const CAMERA_MOVE_MARKERS =
  /\b(push[\s-]?in|pull[\s-]?back|dolly(?:[\s-]?zoom)?|truck|pan|tilt|orbit|tracking|handheld|steadicam|crane|drone|whip[\s-]?pan|zoom|camera(?:\s+move|\s+drift)?|over[\s-]?shoulder|pov|vertigo)\b/i;

const LIGHTING_MARKERS =
  /\b(light(?:ing)?|lit|glow|rim light|backlit|silhouette|golden hour|blue hour|neon|volumetric|softbox|practicals?|moonlight|sunlight|dusk|dawn|overcast|candle|ember|shadow|sunlit)\b/i;

/** Shot scale / lens / composition — disjoint from CAMERA_MOVE_MARKERS. */
const FRAMING_MARKERS =
  /\b(wide|medium(?:\s+shot|\s+close[\s-]?up)?|close[\s-]?up|macro|establishing|aerial|overhead|portrait|landscape|shallow depth|bokeh|depth of field|35mm|50mm|85mm|anamorphic|lens|film\s+look|film\s+grain)\b/i;

/** Shared with composeGpuPrompt so selected Camera Motion is the single source of truth. */
export const CAMERA_MOTION_PHRASE: Record<CameraMotion, string> = {
  "zoom-in": "slow cinematic push-in toward the focal point, steady framing",
  "zoom-out": "smooth pull-back revealing the wider scene, locked horizon",
  "pan-right": "smooth lateral truck to the right, constant subject distance",
  "pan-left": "smooth lateral truck to the left, constant subject distance",
  orbit: "gentle orbital camera drift around the subject, level horizon",
  pulse: "subtle rhythmic scale pulse synced to a soft beat, no hard cuts",
  dramatic: "controlled dolly-zoom perspective shift with strong contrast, no whip cuts",
};

export type VideoPromptStructure = {
  hasMotion: boolean;
  hasCamera: boolean;
  hasLighting: boolean;
  hasFraming: boolean;
  /** 0–4 dimensions present; free-tier quality bar aims for ≥3 on thin prompts after enrich. */
  score: number;
};

export function promptHasCameraMove(prompt: string): boolean {
  return CAMERA_MOVE_MARKERS.test(normalizePromptText(prompt));
}

export function analyzeVideoPromptStructure(prompt: string): VideoPromptStructure {
  const p = normalizePromptText(prompt);
  const hasMotion = MOTION_MARKERS.test(p);
  const hasCamera = CAMERA_MOVE_MARKERS.test(p);
  const hasLighting = LIGHTING_MARKERS.test(p);
  const hasFraming = FRAMING_MARKERS.test(p);
  const score = [hasMotion, hasCamera, hasLighting, hasFraming].filter(Boolean).length;
  return { hasMotion, hasCamera, hasLighting, hasFraming, score };
}

/** Thin prompts that still need subject motion / lighting / framing (camera comes from selected motion). */
export function needsVideoPromptEnrichment(prompt: string): boolean {
  const p = normalizePromptText(prompt);
  const words = p.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  if (words.length >= 40 || p.length >= 280) return false;
  const structure = analyzeVideoPromptStructure(p);
  // Always enrich when subject motion is missing — shared framing+lighting words must not skip it.
  if (!structure.hasMotion) return true;
  return structure.score < 3;
}

const DEFAULT_MOTION = "gentle natural motion in the scene";
const DEFAULT_LIGHTING = "warm practical lighting with soft rim light";
const DEFAULT_FRAMING = "shallow depth of field, clean composition";

export type EnrichVideoOptions = {
  /**
   * Studio Camera Motion selection. When set and the prompt has no camera-move language,
   * that phrase is appended — never a hard-coded push-in that fights the control.
   * When omitted, no camera move is invented (compose / render may add it later).
   */
  motion?: CameraMotion;
};

/**
 * Zero-token enricher for free-tier video: fills missing subject motion / lighting / framing
 * without inventing a conflicting camera move. Keeps the user's words first.
 */
export function enrichVideoPromptLocal(prompt: string, options?: EnrichVideoOptions): string {
  const base = normalizePromptText(prompt);
  if (!base) return base;
  if (!needsVideoPromptEnrichment(base) && !(options?.motion && !promptHasCameraMove(base))) {
    return base;
  }

  const structure = analyzeVideoPromptStructure(base);
  const extras: string[] = [];
  if (!structure.hasMotion) extras.push(DEFAULT_MOTION);
  if (!structure.hasLighting) extras.push(DEFAULT_LIGHTING);
  if (!structure.hasFraming) extras.push(DEFAULT_FRAMING);
  // Only inject camera language when the caller named the selected motion.
  if (!structure.hasCamera && options?.motion) {
    extras.push(CAMERA_MOTION_PHRASE[options.motion]);
  }

  if (extras.length === 0) return base;
  const enriched = normalizePromptText(`${base}, ${extras.join(", ")}`);
  return enriched.slice(0, 500);
}

/** Example starters shown in the studio video panel — teach structure by example. */
export const VIDEO_PROMPT_EXAMPLES: { label: string; prompt: string }[] = [
  {
    label: "Burger sizzle",
    prompt:
      "cast-iron smashed cheeseburger searing on a grill, fat popping and steam rising, neon-rain alley at night, warm ember rim light, macro lens",
  },
  {
    label: "Coastal drone",
    prompt:
      "lone surfer paddling toward a glassy wave, cliffside cove at golden hour, soft volumetric haze, wide anamorphic frame",
  },
  {
    label: "Latte pour",
    prompt:
      "barista pouring latte art into a ceramic cup, creamy swirl forming a leaf, sunlit café counter, soft window light, shallow depth of field",
  },
  {
    label: "Night rain",
    prompt:
      "empty wet city street reflecting neon signs, rain streaking past headlights, cool cyan and magenta glow, 35mm film look",
  },
];

/**
 * System instruction for LLM video enhance.
 * Camera moves are owned by the studio Camera Motion control — do not invent a conflicting one.
 */
export const VIDEO_ENHANCE_SYSTEM = `Rewrite the user's idea into ONE production-ready text-to-video prompt (max 55 words).
Keep their subject and intent. Structure in this order, comma-separated:
1) subject + concrete physical action,
2) setting and time of day,
3) lighting and atmosphere,
4) lens or framing (macro, wide, shallow depth of field).
Prefer simple, plausible subject motion that cheap video models can render.
Do NOT invent a camera move (push-in, pan, orbit, tracking, drone, etc.) unless the user already named one — camera motion is chosen separately.
Avoid readable text, logos, brands, watermarks, morphing faces, and meta instructions.
Output only the prompt — no quotes, labels, or preamble.`;
