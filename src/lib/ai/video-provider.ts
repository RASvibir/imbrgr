/**
 * AI Video Generation & Motion Synthesis Provider for imbrgr.
 * Supports Text-to-Video and Image-to-Video motion animation.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";

function aiMockEnabled(): boolean {
  return process.env.AI_MOCK === "true" || process.env.NODE_ENV === "test";
}

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
  { id: "cinematic", label: "Cinematic Film", promptSuffix: "cinematic lighting, 35mm film, shallow depth of field, 4k" },
  { id: "cyberpunk", label: "Cyberpunk Neon", promptSuffix: "neon glow, dark rain reflections, volumetric lighting, futuristic city" },
  { id: "anime", label: "Anime Motion", promptSuffix: "makoto shinkai aesthetic, vibrant anime animation, dynamic camera, studio quality" },
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
  const suffix = style ? `, ${style.promptSuffix}` : ", smooth cinematic motion, high production value";
  return `${basePrompt.trim()}${suffix}`;
}

/**
 * Generate a synthetic motion animation keyframe sequence for mock or client rendering.
 */
export async function generateAiVideo(params: VideoGenParams): Promise<VideoGenResult> {
  const seed = params.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const durationSec = Math.min(Math.max(params.durationSec ?? 3, 1), 10);
  const fps = params.fps ?? 24;
  const motion = params.motion ?? "zoom-in";
  const { width, height } = resolveVideoDimensions(params.aspectRatio ?? "16:9");

  const isMature = params.mature === true || params.safe === false;

  // In test or mock mode, generate synthetic response
  if (aiMockEnabled()) {
    return {
      previewUrl: params.sourceImageUrl ?? `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="%231a1a24"/><text x="50%" y="50%" fill="%23ff6b2c" font-size="28" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">AI Video: ${encodeURIComponent(params.prompt.slice(0, 30))}</text></svg>`,
      motion,
      durationSec,
      fps,
      width,
      height,
      provider: "imbrgr-ai-motion-mock",
      seed,
      mature: isMature,
    };
  }

  // Live mode: generate base keyframe from prompt if no source image provided
  let previewUrl = params.sourceImageUrl;
  if (!previewUrl) {
    const fullPrompt = buildCinematicVideoPrompt(params.prompt, params.style);
    const safeParam = isMature ? "&safe=false" : "&safe=true";
    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true${safeParam}`;
    try {
      const res = await fetchWithTimeout(pollinationsUrl, { timeoutMs: 25_000 });
      if (res.ok) {
        const raw = Buffer.from(await res.arrayBuffer());
        previewUrl = `data:image/jpeg;base64,${raw.toString("base64")}`;
      } else {
        previewUrl = pollinationsUrl;
      }
    } catch {
      previewUrl = pollinationsUrl;
    }
  }

  return {
    previewUrl: previewUrl ?? "",
    motion,
    durationSec,
    fps,
    width,
    height,
    provider: "imbrgr-motion-synthesizer",
    seed,
    mature: isMature,
  };
}
