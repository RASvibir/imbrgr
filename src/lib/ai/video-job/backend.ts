import { generateKeyframe, type KeyframeParams } from "@/lib/ai/video-generate";
import {
  clampPollinationsVideoDuration,
  fetchPollinationsVideo,
  getPollinationsVideoModelCapabilities,
  pollinationsAssembledEnabled,
  pollinationsMaxClipSec,
  resolvePollinationsVideoModel,
  resolveProviderSeedImageUrl,
} from "@/lib/ai/video-provider";
import { selectStockProvider } from "@/lib/ai/stock/provider";
import { newStorageKey, putObject } from "@/lib/storage";
import { stockQueryFromPrompt, stockQueryLadder } from "./shots";
import type { ContinueMode, LastFrameSource } from "./types";
import { pollGpuClip, storeGpuResult, submitGpuClip } from "@/lib/ai/gpu/client";

export const NOT_FRAME_CHAINED_LABEL = "continued by prompt, not frame-chained";
export const STILL_FROM_LAST_FRAME_LABEL = "continued from the last frame as a still";

export type RenderShotParams = KeyframeParams & {
  stockQuery?: string;
  durationSec?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
  seedImage?: string;
  seedImageSource?: LastFrameSource;
  isContinuation?: boolean;
  /** True only for the first shot of a continuation job, whose seed is the parent clip's last frame. */
  seedFromParent?: boolean;
  continueMode?: ContinueMode;
};

export type RenderShotResult = {
  imageUrl?: string;
  videoUrl?: string;
  mediaType: "image" | "video";
  sourceDurationSec?: number;
  creditName?: string;
  creditUrl?: string;
  lastFrame?: string;
  lastFrameSource?: LastFrameSource;
  frameChained?: boolean;
  continuationFallback?: string;
};

export type AdvanceShotParams = RenderShotParams & {
  remoteId?: string;
  initImage?: string;
};

export type ShotAdvance =
  | { state: "pending"; remoteId: string }
  | { state: "done"; result: RenderShotResult; lastFrame?: string };

export interface ShotBackend {
  name: string;
  tier: 1 | 3;
  supportsContinuation?: boolean;
  isConfigured(): boolean;
  renderShot(params: RenderShotParams): Promise<string | RenderShotResult>;
  /** Long-running backends submit on the first call and are polled on later calls. */
  advanceShot?(params: AdvanceShotParams): Promise<ShotAdvance>;
}

export function backendSupportsContinuation(backend: ShotBackend): boolean {
  return backend.supportsContinuation ?? backend.tier === 3;
}

async function storeLiveKeyframeLastFrame(imageUrl: string): Promise<string | undefined> {
  if (process.env.AI_MOCK === "true") return imageUrl;
  if (process.env.NODE_ENV === "test") return undefined;
  const match = imageUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);
  if (!match) return undefined;
  const [, mime, b64] = match;
  const ext = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
  const stored = await putObject(newStorageKey(ext), Buffer.from(b64, "base64"), mime);
  return stored.url;
}

async function tryPollinationsClip(params: RenderShotParams): Promise<RenderShotResult | null> {
  // Needs sk_ + Pollen; skipped when unset so zero-cost stays stock/stills.
  if (!pollinationsAssembledEnabled() || params.mature) return null;
  try {
    const model = resolvePollinationsVideoModel();
    const maxSec = pollinationsMaxClipSec(model);
    const requestedSec = params.durationSec ?? 5;
    // Never silently clamp down below what the caller asked for; planning splits >maxSec shots.
    if (requestedSec > maxSec) return null;

    const durationSec = clampPollinationsVideoDuration(requestedSec, maxSec);
    const caps = getPollinationsVideoModelCapabilities(model);
    const isChaining = Boolean(params.isContinuation || params.seedImage);
    // Only forward a seed image to Pollinations when it came from a verified client or server source.
    const seedUrl =
      params.seedImageSource === "client" || params.seedImageSource === "server"
        ? resolveProviderSeedImageUrl(params.seedImage)
        : undefined;
    const canInitImage = isChaining && caps.supportsInitImage && Boolean(seedUrl);

    const { buffer, mimeType } = await fetchPollinationsVideo({
      prompt: params.prompt,
      model,
      durationSec,
      aspectRatio: params.aspectRatio,
      seed: params.seed,
      safe: true,
      ...(canInitImage ? { image: seedUrl } : {}),
    });
    const stored = await putObject(newStorageKey("mp4"), buffer, mimeType);
    return {
      videoUrl: stored.url,
      mediaType: "video",
      sourceDurationSec: durationSec,
      creditName: "pollinations",
      creditUrl: "https://enter.pollinations.ai",
      ...(isChaining
        ? canInitImage
          ? { frameChained: true }
          : { frameChained: false, continuationFallback: NOT_FRAME_CHAINED_LABEL }
        : {}),
    };
  } catch (err) {
    console.warn("[imbrgr/ai-video] pollinations video failed, falling back", err);
    return null;
  }
}

export const assembledBackend: ShotBackend = {
  name: "assembled-stills",
  tier: 1,
  supportsContinuation: true,
  isConfigured: () => true,
  renderShot: async (params) => {
    const isContinuation = Boolean(params.isContinuation);
    // Stock results cannot be frame-chained: skip stock on continuation and go to generative tier.
    if (!params.mature && !isContinuation && params.stockQuery) {
      const stock = selectStockProvider();
      if (stock?.isConfigured()) {
        try {
          for (const query of stockQueryLadder(params.stockQuery, stockQueryFromPrompt(params.prompt, 3))) {
            const clip = await stock.searchVideo(query, {
              aspectRatio: params.aspectRatio,
              durationSec: params.durationSec,
            });
            if (clip) {
              return {
                videoUrl: clip.url,
                imageUrl: clip.thumbnailUrl,
                mediaType: "video",
                sourceDurationSec: clip.durationSec,
                creditName: clip.provider,
                creditUrl: clip.pageUrl,
              };
            }
          }
        } catch (err) {
          console.warn("[imbrgr/ai-video] stock search failed, falling back", err);
        }
      }
    }

    // Optional low-cost Pollinations MP4 when POLLINATIONS_API_KEY has Pollen.
    const generated = await tryPollinationsClip(params);
    if (generated) return generated;

    // Continuation fallback when generative video failed or is disabled: reuse the parent's last frame as a
    // still. Never for in-job shots, which must render their own keyframe.
    if (!params.mature && params.seedFromParent && params.seedImage) {
      return {
        imageUrl: params.seedImage,
        mediaType: "image",
        lastFrame: params.seedImage,
        lastFrameSource: params.seedImageSource ?? "server",
        frameChained: true,
        continuationFallback: STILL_FROM_LAST_FRAME_LABEL,
      };
    }

    const imageUrl = await generateKeyframe(params);
    const lastFrame = !params.mature ? await storeLiveKeyframeLastFrame(imageUrl) : undefined;
    return {
      imageUrl,
      mediaType: "image",
      ...(lastFrame ? { lastFrame, lastFrameSource: "server" as const } : {}),
      ...(params.isContinuation && !params.mature
        ? { frameChained: false, continuationFallback: NOT_FRAME_CHAINED_LABEL }
        : {}),
    };
  },
};

export const selfHostedGpuBackend: ShotBackend = {
  name: "self-hosted-gpu",
  tier: 3,
  supportsContinuation: true,
  isConfigured: () => Boolean(process.env.VIDEO_GPU_ENDPOINT),
  renderShot: async () => {
    throw new Error("gpu_backend_not_implemented");
  },
  advanceShot: async (params) => {
    if (!params.remoteId) {
      const remoteId = await submitGpuClip({
        prompt: params.prompt,
        durationSec: params.durationSec ?? 5,
        width: params.width,
        height: params.height,
        seed: params.seed,
        initImage: params.initImage,
      });
      return { state: "pending", remoteId };
    }
    const status = await pollGpuClip(params.remoteId);
    if (status.status === "failed") throw new Error(status.error ?? "gpu_generation_failed");
    if (status.status !== "done") return { state: "pending", remoteId: params.remoteId };
    const stored = await storeGpuResult(status);
    return { state: "done", result: { videoUrl: stored.videoUrl, mediaType: "video" }, lastFrame: stored.lastFrame };
  },
};

export function selectBackend(env: Record<string, string | undefined> = process.env): ShotBackend {
  if (env.VIDEO_PROVIDER === "gpu" && selfHostedGpuBackend.isConfigured()) return selfHostedGpuBackend;
  return assembledBackend;
}
