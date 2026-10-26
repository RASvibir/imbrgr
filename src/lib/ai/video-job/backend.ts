import { generateKeyframe, type KeyframeParams } from "@/lib/ai/video-generate";
import { selectStockProvider } from "@/lib/ai/stock/provider";

export type RenderShotParams = KeyframeParams & {
  stockQuery?: string;
  durationSec?: number;
  aspectRatio?: "16:9" | "9:16" | "1:1";
};

export type RenderShotResult = {
  imageUrl?: string;
  videoUrl?: string;
  mediaType: "image" | "video";
};

export interface ShotBackend {
  name: string;
  tier: 1 | 3;
  isConfigured(): boolean;
  renderShot(params: RenderShotParams): Promise<string | RenderShotResult>;
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
};

export function selectBackend(env: Record<string, string | undefined> = process.env): ShotBackend {
  if (env.VIDEO_PROVIDER === "gpu" && selfHostedGpuBackend.isConfigured()) return selfHostedGpuBackend;
  return assembledBackend;
}
