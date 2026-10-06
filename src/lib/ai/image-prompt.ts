import { STYLES } from "@/lib/ai/styles";

const QUALITY_SUFFIX =
  "masterpiece, best quality, sharp focus, high detail, professional, clean composition";

const NEGATIVE_CUES =
  "no watermark, no text overlay, no logo, no blurry, no low quality, no deformed";

export function buildFluxPrompt(userOrEnhanced: string, styleId?: string): string {
  const styleSuffix = styleId && STYLES[styleId] ? STYLES[styleId] : "";
  const parts = [userOrEnhanced.trim(), styleSuffix, QUALITY_SUFFIX, NEGATIVE_CUES].filter(Boolean);
  return parts.join(", ");
}

export const ASPECT_PRESETS = {
  "1:1": { width: 1024, height: 1024, label: "Square 1024" },
  "16:9": { width: 1344, height: 768, label: "Wide 1344×768" },
  "9:16": { width: 768, height: 1344, label: "Tall 768×1344" },
  "4:3": { width: 1280, height: 960, label: "Classic 1280×960" },
  "3:2": { width: 1536, height: 1024, label: "Photo 1536×1024" },
} as const;

export type AspectPresetId = keyof typeof ASPECT_PRESETS;
