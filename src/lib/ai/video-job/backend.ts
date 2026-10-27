import { generateKeyframe, type KeyframeParams } from "@/lib/ai/video-generate";
import { selectStockProvider } from "@/lib/ai/stock/provider";
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

export const assembledBackend: ShotBackend = {
  name: "assembled-stills",
  tier: 1,
  isConfigured: () => true,
  renderShot: async (params) => {
    if (!params.mature && params.stockQuery) {
      const stock = selectStockProvider();
      if (stock?.isConfigured()) {
        try {
          const clip = await stock.searchVideo(params.stockQuery, {
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
        } catch (err) {
          console.warn("[imbrgr/ai-video] stock search failed, falling back to keyframe", err);
        }
      }
    }

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
