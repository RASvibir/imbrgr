/**
 * AI Video Generation & Motion Synthesis Provider for imbrgr.
 * Supports Text-to-Video and Image-to-Video motion animation.
 *
 * Assembled path (zero-cost first): stock → Pollinations (needs sk_ + Pollen) → stills.
 * Pollinations catalog video models are currently paid_only; create a secret key at
 * https://enter.pollinations.ai/keys. Disable with AI_VIDEO_ASSEMBLED_POLLINATIONS=false.
 */

import { fetchWithTimeout } from "@/lib/fetch-timeout";
import type { VideoMode } from "@/lib/ai/video-limits";
import { VIDEO_NEGATIVE_CUES, VIDEO_QUALITY_SUFFIX } from "@/lib/ai/video-prompt";
import { MAX_VIDEO_BYTES } from "@/lib/validation";

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
  {
    id: "cinematic",
    label: "Cinematic Film",
    // Look/grade only — camera moves come from the Camera Motion control.
    promptSuffix: "cinematic color grade, 35mm film grain, shallow depth of field, motivated practical lighting",
  },
  {
    id: "cyberpunk",
    label: "Cyberpunk Neon",
    promptSuffix: "neon glow and wet asphalt reflections, volumetric light shafts, futuristic night city, rain-soaked streets",
  },
  {
    id: "anime",
    label: "Anime Motion",
    promptSuffix:
      "vibrant anime look, painterly backgrounds, expressive secondary motion, soft glowing rim light, clean cel shading",
  },
  {
    id: "hyperlapse",
    label: "Urban Hyperlapse",
    promptSuffix: "urban night energy, light trails, controlled motion blur, dramatic vanishing-point perspective, time-compressed feel",
  },
  {
    id: "macro",
    label: "Macro Sizzle",
    promptSuffix: "extreme macro close-up, sizzling textures and rising steam, droplet detail, mouth-watering focus, warm key light",
  },
  {
    id: "retro",
    label: "Retro 80s Synth",
    promptSuffix: "80s retro synthwave look, chrome reflections, neon grid horizon, sunset glow",
  },
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
  const trimmed = basePrompt.trim();
  if (!trimmed) return trimmed;
  const style = VIDEO_STYLES.find((s) => s.id === styleId);
  const styleSuffix = style ? style.promptSuffix : "smooth cinematic motion, motivated lighting";
  // Avoid duplicating quality/negative cues when compose or enhance already appended them.
  const parts = [trimmed];
  if (!trimmed.toLowerCase().includes(styleSuffix.slice(0, 24).toLowerCase())) {
    parts.push(styleSuffix);
  }
  if (!/\bsmooth continuous motion\b/i.test(trimmed)) parts.push(VIDEO_QUALITY_SUFFIX);
  if (!/\bno watermark\b/i.test(trimmed)) parts.push(VIDEO_NEGATIVE_CUES);
  return parts.join(", ");
}

// --- Pollinations Gen (https://gen.pollinations.ai) ---------------------------

/** Cheap, healthy text→video default from the live catalog (publisher/model IDs). */
export const DEFAULT_POLLINATIONS_VIDEO_MODEL = "prunaai/p-video";

export type PollinationsVideoParams = {
  prompt: string;
  model?: string;
  durationSec: number;
  aspectRatio?: string;
  seed?: number;
  safe?: boolean;
};

const GEN_BASE = (process.env.POLLINATIONS_GEN_URL ?? "https://gen.pollinations.ai").replace(/\/$/, "");

export function pollinationsApiKey(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const key = env.POLLINATIONS_API_KEY?.trim();
  return key || undefined;
}

/** Server-side secret keys are `sk_…`. Publishable `pk_…` keys return 401 on generation. */
export function pollinationsAuthHeaders(env: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const key = pollinationsApiKey(env);
  return key ? { Authorization: `Bearer ${key}` } : {};
}

export function resolvePollinationsVideoModel(params?: Pick<PollinationsVideoParams, "model">): string {
  return params?.model ?? process.env.AI_VIDEO_MODEL ?? DEFAULT_POLLINATIONS_VIDEO_MODEL;
}

/** Clamp to a range the default cheap models accept (catalog: often 1–10s or 5s fixed). */
export function clampPollinationsVideoDuration(sec: number | undefined): number {
  const n = sec == null || !Number.isFinite(sec) ? 5 : sec;
  return Math.min(Math.max(Math.round(n), 1), 10);
}

/** Build GET URL for `/video/{prompt}` — auth goes in the Authorization header, not the query. */
export function pollinationsVideoUrl(params: PollinationsVideoParams): string {
  const model = resolvePollinationsVideoModel(params);
  const encodedPrompt = encodeURIComponent(params.prompt);
  const url = new URL(`${GEN_BASE}/video/${encodedPrompt}`);
  url.searchParams.set("model", model);
  url.searchParams.set("duration", String(params.durationSec));
  if (params.aspectRatio) url.searchParams.set("aspectRatio", params.aspectRatio);
  if (params.seed != null) url.searchParams.set("seed", String(params.seed));
  if (params.safe) url.searchParams.set("safe", "true");
  return url.toString();
}

/**
 * Pollinations video needs a secret key with Pollen (catalog models are paid_only).
 * Without a key, assembled stays on free stock / still keyframes.
 */
export function pollinationsAssembledEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.AI_MOCK === "true" || env.NODE_ENV === "test") return false;
  if (env.AI_VIDEO_ASSEMBLED_POLLINATIONS === "false") return false;
  return Boolean(pollinationsApiKey(env));
}

function pollinationsFetchTimeoutMs(): number {
  const n = Number(process.env.AI_VIDEO_POLLINATIONS_TIMEOUT_MS);
  return Number.isFinite(n) && n > 5_000 ? n : 120_000;
}

function pollinationsJobPollMs(): number {
  const n = Number(process.env.AI_VIDEO_POLLINATIONS_POLL_MS);
  return Number.isFinite(n) && n >= 1_000 ? n : 5_000;
}

async function downloadVideoBody(res: Response): Promise<{ buffer: Buffer; mimeType: string }> {
  const mime = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "video/mp4";
  if (!mime.startsWith("video/")) throw new Error("video upstream returned non-video");
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0 || buf.length > MAX_VIDEO_BYTES) throw new Error("video upstream bad size");
  return { buffer: buf, mimeType: mime };
}

type AsyncJobStatus = {
  id?: string;
  status?: string;
  result_url?: string;
  error?: { message?: string; code?: string } | string;
};

/**
 * Fetch MP4 via Pollinations Gen. Prefers async jobs (`Prefer: respond-async`) so long
 * generations do not hold one connection open; falls back to a synchronous response.
 */
export async function fetchPollinationsVideo(
  params: PollinationsVideoParams,
): Promise<{ buffer: Buffer; mimeType: string }> {
  const key = pollinationsApiKey();
  if (!key) throw new Error("POLLINATIONS_API_KEY required for video");

  const url = pollinationsVideoUrl(params);
  const headers = {
    ...pollinationsAuthHeaders(),
    Prefer: "respond-async",
  };

  const res = await fetchWithTimeout(url, {
    redirect: "follow",
    headers,
    timeoutMs: pollinationsFetchTimeoutMs(),
  });

  // Cached / sync completion
  if (res.status === 200) return downloadVideoBody(res);

  if (res.status !== 202) {
    throw new Error(`video upstream ${res.status}`);
  }

  const job = (await res.json().catch(() => null)) as AsyncJobStatus | null;
  const jobId = job?.id;
  if (!jobId) throw new Error("video upstream missing job id");

  const deadline = Date.now() + pollinationsFetchTimeoutMs();
  const pollEvery = pollinationsJobPollMs();

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, pollEvery));
    const statusRes = await fetchWithTimeout(`${GEN_BASE}/v1/jobs/${encodeURIComponent(jobId)}`, {
      headers: pollinationsAuthHeaders(),
      timeoutMs: 20_000,
    });
    if (!statusRes.ok) throw new Error(`video job status ${statusRes.status}`);
    const status = (await statusRes.json()) as AsyncJobStatus;
    const state = status.status?.toLowerCase();
    if (state === "failed") {
      const err = typeof status.error === "string" ? status.error : status.error?.message;
      throw new Error(err ? `video job failed: ${err}` : "video job failed");
    }
    if (state === "succeeded" || state === "completed" || state === "done") {
      const resultRes = await fetchWithTimeout(
        `${GEN_BASE}/v1/jobs/${encodeURIComponent(jobId)}/result`,
        { headers: pollinationsAuthHeaders(), redirect: "follow", timeoutMs: 60_000 },
      );
      if (!resultRes.ok) throw new Error(`video job result ${resultRes.status}`);
      return downloadVideoBody(resultRes);
    }
  }

  throw new Error("video job timeout");
}
