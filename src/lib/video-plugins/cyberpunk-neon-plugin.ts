/**
 * Cyberpunk Neon Glow filter plugin.
 * Inspired by pacNcap color transformation pipelines.
 */

import type { VideoPlugin } from "@/lib/video-plugins/plugin-types";

export const cyberpunkNeonPlugin: VideoPlugin = {
  metadata: {
    id: "pacncap_cyberpunk_neon",
    name: "Cyberpunk Neon",
    version: "1.0.0",
    author: "RASvibir / pacNcap",
    description: "Vibrant high-contrast neon aesthetic with electric cyan and magenta split toning.",
    category: "filter",
  },
  requirements: {
    requiresWebGPU: false,
  },
  params: [
    { id: "glow", label: "Neon Glow", type: "number", default: 0.8, min: 0.1, max: 1, step: 0.1 },
  ],
  onFrameProcess(frameData, ctx, params) {
    if (ctx.performanceMode === "eco") return frameData;

    const glow = typeof params?.glow === "number" ? params.glow : 0.8;
    const { data } = frameData;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;

      // Contrast S-curve
      const contrast = (val: number) => {
        const norm = val / 255;
        const curved = norm < 0.5 ? 2 * norm * norm : 1 - 2 * (1 - norm) * (1 - norm);
        return Math.min(255, Math.max(0, Math.floor(curved * 255)));
      };

      if (lum > 128) {
        // Highlights pushed toward electric magenta/cyan
        data[i] = Math.min(255, Math.floor(contrast(r) * (1 + 0.25 * glow)));
        data[i + 1] = Math.min(255, Math.floor(contrast(g) * 0.9));
        data[i + 2] = Math.min(255, Math.floor(contrast(b) * (1 + 0.35 * glow)));
      } else {
        // Shadows pushed toward deep midnight teal
        data[i] = Math.floor(contrast(r) * 0.7);
        data[i + 1] = Math.min(255, Math.floor(contrast(g) * (1 + 0.15 * glow)));
        data[i + 2] = Math.min(255, Math.floor(contrast(b) * (1 + 0.3 * glow)));
      }
    }

    return frameData;
  },
};
