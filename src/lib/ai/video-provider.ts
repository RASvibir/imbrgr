/**
 * AI Video Generation & Motion Synthesis Provider for imbrgr.
 * Supports Text-to-Video and Image-to-Video motion animation.
 */

import type { VideoMode } from "@/lib/ai/video-limits";

export type CameraMotion =
  | "zoom-in"
  | "zoom-out"
  | "pan-right"
  | "pan-left"
  | "orbit"
  | "pulse"
  | "dramatic";

export type VideoGenParams = {
  prompt: string;
  sourceImageUrl?: string;
  motion?: CameraMotion;
  mode?: VideoMode;
  durationSec?: number;
  fps?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  style?: string;
  seed?: number;
  safe?: boolean;
  mature?: boolean;
};

export type VideoGenResult = {
  frames?: string[]; // Data URLs for keyframes / animation frames
  previewUrl: string; // URL or Data URL for generated video/clip preview
  motion: CameraMotion;
  durationSec: number;
  fps: number;
  width: number;
  height: number;
  provider: string;
  seed: number;
  mature?: boolean;
};

export const VIDEO_STYLES = [
  { id: "cinematic", label: "Cinematic Film", promptSuffix: "cinematic lighting, 35mm film look, shallow depth of field" },
  { id: "cyberpunk", label: "Cyberpunk Neon", promptSuffix: "neon glow, dark rain reflections, volumetric lighting, futuristic city" },
  { id: "anime", label: "Anime Motion", promptSuffix: "vibrant anime animation, painterly backgrounds, expressive motion, soft glowing light" },
  { id: "hyperlapse", label: "Urban Hyperlapse", promptSuffix: "high-speed hyperlapse, light trails, smooth motion blur, dramatic perspective" },
  { id: "macro", label: "Macro Sizzle", promptSuffix: "extreme macro close-up, sizzling textures, steam droplets, mouth-watering focus" },
  { id: "retro", label: "Retro 80s Synth", promptSuffix: "80s retro aesthetic, chrome reflections, synthwave horizon, sunset glow" },
] as const;

export const CAMERA_MOTIONS: { id: CameraMotion; label: string; description: string }[] = [
  { id: "zoom-in", label: "Slow Push-In", description: "Cinematic push toward focal point" },
  { id: "zoom-out", label: "Reveal Pull-Back", description: "Smooth pull back to reveal scene" },
  { id: "pan-right", label: "Truck Right", description: "Horizontal sweeping tracking shot" },
  { id: "pan-left", label: "Truck Left", description: "Leftward sweeping tracking shot" },
  { id: "orbit", label: "Orbital Drift", description: "Gentle rotational camera orbit" },
  { id: "pulse", label: "Beat Pulse", description: "Rhythmic bass zoom pulse" },
  { id: "dramatic", label: "Dolly Zoom (Vertigo)", description: "Dramatic contrast zoom & perspective shift" },
];

export function resolveVideoDimensions(aspectRatio: "16:9" | "9:16" | "1:1" = "16:9"): { width: number; height: number } {
  switch (aspectRatio) {
    case "9:16":
      return { width: 720, height: 1280 };
    case "1:1":
      return { width: 1080, height: 1080 };
    case "16:9":
    default:
      return { width: 1280, height: 720 };
  }
}

export function buildCinematicVideoPrompt(basePrompt: string, styleId?: string): string {
  const style = VIDEO_STYLES.find((s) => s.id === styleId);
  const suffix = style ? `, ${style.promptSuffix}` : ", smooth cinematic motion";
  return `${basePrompt.trim()}${suffix}`;
}
