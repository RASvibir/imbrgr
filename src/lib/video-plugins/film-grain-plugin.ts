/**
 * 35mm Cinema Film Grain & Vignette plugin.
 * Adapted from pacNcap organic film simulation.
 */

import type { VideoPlugin } from "@/lib/video-plugins/plugin-types";

export const filmGrainPlugin: VideoPlugin = {
  metadata: {
    id: "pacncap_film_grain",
    name: "35mm Film Grain",
    version: "1.0.0",
    author: "RASvibir / pacNcap",
    description: "Authentic 35mm silver halide film grain and soft cinematic vignette.",
    category: "filter",
  },
  requirements: {
    requiresWebGPU: false,
  },
  params: [
    { id: "grainAmount", label: "Grain Amount", type: "number", default: 0.15, min: 0.05, max: 0.5, step: 0.05 },
    { id: "vignette", label: "Vignette Darkness", type: "number", default: 0.35, min: 0, max: 0.8, step: 0.05 },
  ],
  onFrameProcess(frameData, ctx, params) {
    if (ctx.performanceMode === "eco") return frameData;

    const grainAmount = typeof params?.grainAmount === "number" ? params.grainAmount : 0.15;
    const vignette = typeof params?.vignette === "number" ? params.vignette : 0.35;
    const { width, height, data } = frameData;

    const cx = width / 2;
    const cy = height / 2;
    const maxDist = Math.sqrt(cx * cx + cy * cy);

    for (let y = 0; y < height; y++) {
      const dy = y - cy;
      for (let x = 0; x < width; x++) {
        const dx = x - cx;
        const i = (y * width + x) * 4;

        // Vignette factor based on radial distance
        const dist = Math.sqrt(dx * dx + dy * dy) / maxDist;
        const vigFactor = 1 - Math.pow(dist, 2) * vignette;

        // Film grain noise (-grain to +grain)
        const grain = (Math.random() - 0.5) * grainAmount * 255;

        data[i] = Math.min(255, Math.max(0, Math.floor(data[i] * vigFactor + grain)));
        data[i + 1] = Math.min(255, Math.max(0, Math.floor(data[i + 1] * vigFactor + grain)));
        data[i + 2] = Math.min(255, Math.max(0, Math.floor(data[i + 2] * vigFactor + grain)));
      }
    }

    return frameData;
  },
};
