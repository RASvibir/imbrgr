/**
 * imbrgr Photo Filters exposed as pacNcap video plugins.
 * Allows real-time rendering in the video preview player and WebM video exports.
 */

import { PHOTO_FILTERS, applyPhotoFilter } from "@/lib/photo-filters";
import type { VideoPlugin } from "@/lib/video-plugins/plugin-types";

export const PHOTO_FILTER_PLUGINS: VideoPlugin[] = PHOTO_FILTERS.map((f) => ({
  metadata: {
    id: `imbrgr_photo_${f.id}`,
    name: `${f.emoji} ${f.label}`,
    version: "1.0.0",
    author: "imbrgr Creative",
    description: f.description,
    category: "filter" as const,
  },
  requirements: { requiresWebGPU: false },
  params: [
    {
      id: "intensity",
      label: "Intensity",
      type: "number",
      default: 1,
      min: 0,
      max: 1,
      step: 0.05,
    },
  ],
  onFrameProcess(frameData, ctx, params) {
    const intensity = typeof params?.intensity === "number" ? params.intensity : 1;
    applyPhotoFilter(frameData, f.id, {
      timeSec: ctx.timeSec ?? 0,
      intensity,
    });
    return frameData;
  },
}));
