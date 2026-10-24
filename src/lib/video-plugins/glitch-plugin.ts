/**
 * Digital Glitch & RGB Split plugin.
 * Adapted from pacNcap transition and visual FX shaders.
 */

import type { VideoPlugin } from "@/lib/video-plugins/plugin-types";

export const glitchPlugin: VideoPlugin = {
  metadata: {
    id: "pacncap_glitch",
    name: "Cyber Glitch",
    version: "1.0.0",
    author: "RASvibir / pacNcap",
    description: "Digital artifacting, scanline slice offset, and chromatic RGB tearing.",
    category: "effect",
  },
  requirements: {
    requiresWebGPU: false,
  },
  params: [
    { id: "sliceChance", label: "Glitch Slice Chance", type: "number", default: 0.25, min: 0.05, max: 0.8, step: 0.05 },
    { id: "displacement", label: "Max Displacement", type: "number", default: 8, min: 2, max: 30, step: 2 },
  ],
  onFrameProcess(frameData, ctx, params) {
    if (ctx.performanceMode === "eco") return frameData;

    const sliceChance = typeof params?.sliceChance === "number" ? params.sliceChance : 0.25;
    const maxDisp = typeof params?.displacement === "number" ? params.displacement : 8;
    const { width, height, data } = frameData;
    const copy = new Uint8ClampedArray(data);

    // Pick a few slice bands to displace horizontally
    const sliceHeight = Math.max(2, Math.floor(height / 30));
    for (let y = 0; y < height; y += sliceHeight) {
      const shouldGlitch = Math.random() < sliceChance;
      const offset = shouldGlitch ? Math.floor((Math.random() - 0.5) * maxDisp * 2) : 0;

      for (let sy = y; sy < Math.min(height, y + sliceHeight); sy++) {
        for (let x = 0; x < width; x++) {
          const srcX = Math.min(width - 1, Math.max(0, x + offset));
          const i = (sy * width + x) * 4;
          const si = (sy * width + srcX) * 4;

          // Displace green and blue channels with slice offset, keep red base
          data[i] = copy[i];
          data[i + 1] = copy[si + 1];
          data[i + 2] = copy[si + 2];
        }
      }
    }

    return frameData;
  },
};
