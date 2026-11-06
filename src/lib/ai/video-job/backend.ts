import { generateKeyframe, type KeyframeParams } from "@/lib/ai/video-generate";
import {
  clampPollinationsVideoDuration,
  fetchPollinationsVideo,
  pollinationsAssembledEnabled,
} from "@/lib/ai/video-provider";
import { selectStockProvider } from "@/lib/ai/stock/provider";
import { newStorageKey, putObject } from "@/lib/storage";
import { stockQueryFromPrompt, stockQueryLadder } from "./shots";
import { pollGpuClip, storeGpuResult, submitGpuClip } from "@/lib/ai/gpu/client";

export type RenderShotParams = KeyframeParams & {
  stockQuery?: string;
  durationSec?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
};

export type RenderShotResult = {
  imageUrl?: string;
  videoUrl?: string;
  mediaType: "image" | "video";
  sourceDurationSec?: number;
  creditName?: string;
  creditUrl?: string;
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
  isConfigured(): boolean;
  renderShot(params: RenderShotParams): Promise<string | RenderShotResult>;
  /** Long-running backends submit on the first call and are polled on later calls. */
  advanceShot?(params: AdvanceShotParams): Promise<ShotAdvance>;
}

async function tryPollinationsClip(params: RenderShotParams): Promise<RenderShotResult | null> {
  // Needs sk_ + Pollen; skipped when unset so zero-cost stays stock/stills.
  if (!pollinationsAssembledEnabled() || params.mature) return null;
  try {
    const durationSec = clampPollinationsVideoDuration(params.durationSec);
    const { buffer, mimeType } = await fetchPollinationsVideo({
      prompt: params.prompt,
      durationSec,
      aspectRatio: params.aspectRatio,
      seed: params.seed,
      safe: true,
    });
    const stored = await putObject(newStorageKey("mp4"), buffer, mimeType);
    return {
      videoUrl: stored.url,
      mediaType: "video",
      sourceDurationSec: durationSec,
      creditName: "pollinations",
      creditUrl: "https://enter.pollinations.ai",
    };
  } catch (err) {
    console.warn("[imbrgr/ai-video] pollinations video failed, falling back", err);
    return null;
  }
}

export const assembledBackend: ShotBackend = {
  name: "assembled-stills",
  tier: 1,
  isConfigured: () => true,
  renderShot: async (params) => {
    if (!params.mature && params.stockQuery) {
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

    const imageUrl = await generateKeyframe(params);
    return {
      imageUrl,
      mediaType: "image",
    };
  },
};

export const selfHostedGpuBackend: ShotBackend = {
  name: "self-hosted-gpu",
  tier: 3,
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
