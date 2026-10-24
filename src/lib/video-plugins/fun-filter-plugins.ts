/**
 * imbrgr Fun Filters exposed as pacNcap plugins so they work in the
 * preview, the plugin panel, and the exported WebM.
 */

import { FUN_FILTERS, applyFunFilter } from "@/lib/fun-filters";
import type { VideoPlugin } from "@/lib/video-plugins/plugin-types";

export const FUN_FILTER_PLUGINS: VideoPlugin[] = FUN_FILTERS.map((f) => ({
  metadata: {
    id: `imbrgr_fun_${f.id}`,
    name: `${f.emoji} ${f.label}`,
    version: "1.0.0",
    author: "ChloReform Studios",
    description: f.description,
    category: "filter" as const,
  },
  requirements: { requiresWebGPU: false },
  params: [
    { id: "intensity", label: "Silliness", type: "number", default: 1, min: 0.1, max: 1, step: 0.05 },
  ],
  onFrameProcess(frameData, ctx, params) {
    const intensity = typeof params?.intensity === "number" ? params.intensity : 1;
    applyFunFilter(frameData, f.id, { timeSec: ctx.timeSec ?? 0, intensity });
    return frameData;
  },
}));
