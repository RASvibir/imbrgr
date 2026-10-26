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

export type KeyframeParams = {
  prompt: string;
  style?: string;
  width: number;
  height: number;
  seed: number;
  mature: boolean;
};

function mockKeyframeUrl(prompt: string, width: number, height: number): string {
  return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="%231a1a24"/><text x="50%" y="50%" fill="%23ff6b2c" font-size="28" font-family="sans-serif" text-anchor="middle" dominant-baseline="middle">AI Video: ${encodeURIComponent(prompt.slice(0, 30))}</text></svg>`;
}

/** One still keyframe as a data URL. Failures throw so callers can report them. */
export async function generateKeyframe(params: KeyframeParams): Promise<string> {
  if (aiMockEnabled()) return mockKeyframeUrl(params.prompt, params.width, params.height);
  const image = await defaultImageProvider.generate({
    prompt: buildCinematicVideoPrompt(params.prompt, params.style),
    width: params.width,
    height: params.height,
    seed: params.seed,
    safe: !params.mature,
    maxAttempts: VIDEO_IMAGE_MAX_ATTEMPTS,
    timeoutMs: VIDEO_IMAGE_TIMEOUT_MS,
  });
  const jpeg = await sharp(image.buffer).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
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

  if (aiMockEnabled()) {
    return {
      previewUrl: params.sourceImageUrl ?? mockKeyframeUrl(params.prompt, width, height),
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

  const previewUrl =
    params.sourceImageUrl ??
    (await generateKeyframe({
      prompt: params.prompt,
      style: params.style,
      width,
      height,
      seed,
      mature: isMature,
    }));

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
