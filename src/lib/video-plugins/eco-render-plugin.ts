/**
 * Adapted from MIT-licensed RASvibir/pacNcap (OpenCut fork) eco render plugin.
 * Copyright (c) 2026 OpenCut
 */

import type { VideoPlugin } from "@/lib/video-plugins/plugin-types";

export const ecoRenderPlugin: VideoPlugin = {
  metadata: {
    id: "imbrgr_eco_render",
    name: "Eco Render Filter",
    version: "1.0.0",
    author: "RASvibir / OpenCut",
    description: "Low-cost desaturation pass for smoother scrub previews.",
  },
  requirements: {
    requiresWebGPU: false,
  },
  onFrameProcess(frameData, ctx) {
    if (ctx.performanceMode === "eco") return frameData;

    const data = frameData.data;
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
      data[i] = avg;
      data[i + 1] = avg;
      data[i + 2] = avg;
    }
    return frameData;
  },
};
