/**
 * Film Noir High-Contrast Monochrome plugin.
 * Adapted from pacNcap classic cinema shaders.
 */

import type { VideoPlugin } from "@/lib/video-plugins/plugin-types";

export const noirPlugin: VideoPlugin = {
  metadata: {
    id: "pacncap_film_noir",
    name: "Classic Noir",
    version: "1.0.0",
    author: "RASvibir / pacNcap",
    description: "Dramatic black-and-white tonal scale with deep shadows and specular highlights.",
    category: "filter",
  },
  requirements: {
    requiresWebGPU: false,
  },
  params: [
    { id: "contrast", label: "Contrast Boost", type: "number", default: 1.3, min: 1, max: 2, step: 0.1 },
  ],
  onFrameProcess(frameData, ctx, params) {
    if (ctx.performanceMode === "eco") {
      // In eco mode, basic desaturate
      const data = frameData.data;
      for (let i = 0; i < data.length; i += 4) {
        const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
        data[i] = avg;
        data[i + 1] = avg;
        data[i + 2] = avg;
      }
      return frameData;
    }

    const contrast = typeof params?.contrast === "number" ? params.contrast : 1.3;
    const { data } = frameData;

    for (let i = 0; i < data.length; i += 4) {
      // Perceptual luminance
      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const norm = lum / 255;
      // High contrast S-curve
      const shifted = Math.min(255, Math.max(0, Math.floor(((norm - 0.5) * contrast + 0.5) * 255)));

      data[i] = shifted;
      data[i + 1] = shifted;
      data[i + 2] = shifted;
    }

    return frameData;
  },
};
