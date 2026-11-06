/**
 * Deterministic video-prompt quality helpers.
 * Used when LLM enhance is unavailable/skipped, and as structure checks for eval fixtures.
 */

import { normalizePromptText } from "@/lib/ai/prompt-heuristics";

/** Appended by buildCinematicVideoPrompt — favors free text→video models (stock/stills/cheap gen). */
export const VIDEO_QUALITY_SUFFIX =
  "smooth continuous motion, coherent subject, stable framing, high detail, clean composition";

export const VIDEO_NEGATIVE_CUES =
  "no watermark, no text overlay, no logo, no title card, no jitter, no morphing faces, no flicker, no cutaway";

const MOTION_MARKERS =
  /\b(slow[\s-]?motion|motion|moves?|moving|sizzl\w*|steam\w*|dripp\w*|pour\w*|ris\w*|fall\w*|drift\w*|sway\w*|spin\w*|orbit\w*|flow\w*|flicker\w*|pulse\w*|ripple\w*|glow\w*|spark\w*|flame\w*|smoke\w*|rain\w*|wind\w*|walk\w*|run\w*|fly\w*|float\w*|rotate\w*|turn\w*|swirl\w*|melt\w*|boil\w*|bubble\w*)\b/i;

const CAMERA_MARKERS =
  /\b(push[\s-]?in|pull[\s-]?back|dolly|truck|pan|tilt|orbit|tracking|handheld|steadicam|crane|drone|aerial|whip[\s-]?pan|zoom|camera|lens|macro|wide|close[\s-]?up|medium shot|establishing|low[\s-]?angle|high[\s-]?angle|over[\s-]?shoulder|pov)\b/i;

const LIGHTING_MARKERS =
  /\b(light(?:ing)?|lit|glow|rim light|backlit|silhouette|golden hour|blue hour|neon|volumetric|softbox|practicals?|moonlight|sunlight|dusk|dawn|overcast|candle|ember|shadow)\b/i;

const FRAMING_MARKERS =
  /\b(wide|medium|close[\s-]?up|macro|establishing|aerial|overhead|portrait|landscape|shallow depth|bokeh|depth of field|35mm|50mm|85mm|anamorphic)\b/i;

export type VideoPromptStructure = {
  hasMotion: boolean;
  hasCamera: boolean;
  hasLighting: boolean;
  hasFraming: boolean;
  /** 0–4 dimensions present; free-tier quality bar aims for ≥3 on thin prompts after enrich. */
  score: number;
};

export function analyzeVideoPromptStructure(prompt: string): VideoPromptStructure {
  const p = normalizePromptText(prompt);
  const hasMotion = MOTION_MARKERS.test(p);
  const hasCamera = CAMERA_MARKERS.test(p);
  const hasLighting = LIGHTING_MARKERS.test(p);
  const hasFraming = FRAMING_MARKERS.test(p);
  const score = [hasMotion, hasCamera, hasLighting, hasFraming].filter(Boolean).length;
  return { hasMotion, hasCamera, hasLighting, hasFraming, score };
}

/** Thin prompts that still need motion/camera language even if they mention "cinematic". */
export function needsVideoPromptEnrichment(prompt: string): boolean {
  const p = normalizePromptText(prompt);
  const words = p.split(/\s+/).filter(Boolean);
  if (words.length === 0) return false;
  if (words.length >= 40 || p.length >= 280) return false;
  const { score } = analyzeVideoPromptStructure(p);
  return score < 3;
}

const DEFAULT_MOTION = "gentle natural motion in the scene";
const DEFAULT_CAMERA = "slow cinematic push-in";
const DEFAULT_LIGHTING = "warm practical lighting with soft rim light";
const DEFAULT_FRAMING = "shallow depth of field, clean composition";

/**
 * Zero-token enricher for free-tier video: fills missing motion / camera / lighting / framing
 * without inventing a new subject. Keeps the user's words first.
 */
export function enrichVideoPromptLocal(prompt: string): string {
  const base = normalizePromptText(prompt);
  if (!base) return base;
  if (!needsVideoPromptEnrichment(base)) return base;

  const structure = analyzeVideoPromptStructure(base);
  const extras: string[] = [];
  if (!structure.hasMotion) extras.push(DEFAULT_MOTION);
  if (!structure.hasCamera) extras.push(DEFAULT_CAMERA);
  if (!structure.hasLighting) extras.push(DEFAULT_LIGHTING);
  if (!structure.hasFraming) extras.push(DEFAULT_FRAMING);

  const enriched = normalizePromptText(`${base}, ${extras.join(", ")}`);
  return enriched.slice(0, 500);
}

/** Example starters shown in the studio video panel — teach structure by example. */
export const VIDEO_PROMPT_EXAMPLES: { label: string; prompt: string }[] = [
  {
    label: "Burger sizzle",
    prompt:
      "cast-iron smashed cheeseburger searing on a grill, fat popping and steam rising, neon-rain alley at night, slow push-in, warm ember rim light, macro lens",
  },
  {
    label: "Coastal drone",
    prompt:
      "lone surfer paddling toward a glassy wave, cliffside cove at golden hour, smooth drone orbit, soft volumetric haze, wide anamorphic frame",
  },
  {
    label: "Latte pour",
    prompt:
      "barista pouring latte art into a ceramic cup, creamy swirl forming a leaf, sunlit café counter, gentle overhead tilt-down, soft window light, shallow depth of field",
  },
  {
    label: "Night rain",
    prompt:
      "empty wet city street reflecting neon signs, rain streaking past headlights, slow tracking shot left to right, cool cyan and magenta glow, 35mm film look",
  },
];

/** System instruction for LLM video enhance (exported for tests / fixtures). */
export const VIDEO_ENHANCE_SYSTEM = `Rewrite the user's idea into ONE production-ready text-to-video prompt (max 55 words).
Keep their subject and intent. Structure in this order, comma-separated:
1) subject + concrete physical action,
2) setting and time of day,
3) camera move (push-in, pull-back, orbit, pan, tracking, drone, etc.),
4) lighting and atmosphere,
5) lens or framing (macro, wide, shallow depth of field).
Prefer simple, plausible motion that cheap video models can render. Avoid readable text, logos, brands, watermarks, morphing faces, and meta instructions.
Output only the prompt — no quotes, labels, or preamble.`;
