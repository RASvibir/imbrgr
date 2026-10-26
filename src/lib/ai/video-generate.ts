/**
 * Server-only AI video generation. Kept apart from video-provider.ts so client
 * components can import its types and constants without bundling sharp.
 */

import sharp from "sharp";
import { defaultImageProvider } from "@/lib/ai/image-provider";
import {
  buildCinematicVideoPrompt,
  resolveVideoDimensions,
  type VideoGenParams,
  type VideoGenResult,
} from "@/lib/ai/video-provider";
import { clampVideoDuration } from "@/lib/ai/video-limits";

// Route maxDuration is 60s: 2 attempts x 22s plus backoff stays under it.
const VIDEO_IMAGE_MAX_ATTEMPTS = 2;
const VIDEO_IMAGE_TIMEOUT_MS = 22_000;

function aiMockEnabled(): boolean {
  return process.env.AI_MOCK === "true" || process.env.NODE_ENV === "test";
}

/**
 * Generate a synthetic motion animation keyframe sequence for mock or client rendering.
 */
export async function generateAiVideo(params: VideoGenParams): Promise<VideoGenResult> {
  const seed = params.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const durationSec = clampVideoDuration(params.mode ?? "video", params.durationSec);
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

  // Live mode: generate base keyframe from prompt if no source image provided.
  // Uses the shared image provider (API key, retries). Failures throw so the route reports them.
  let previewUrl = params.sourceImageUrl;
  if (!previewUrl) {
    const fullPrompt = buildCinematicVideoPrompt(params.prompt, params.style);
    const image = await defaultImageProvider.generate({
      prompt: fullPrompt,
      width,
      height,
      seed,
      safe: !isMature,
      maxAttempts: VIDEO_IMAGE_MAX_ATTEMPTS,
      timeoutMs: VIDEO_IMAGE_TIMEOUT_MS,
    });
    const jpeg = await sharp(image.buffer).jpeg({ quality: 82 }).toBuffer();
    previewUrl = `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  }

  return {
    previewUrl,
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
