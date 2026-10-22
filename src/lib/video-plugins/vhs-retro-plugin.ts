/**
 * VHS Retro 90s Camcorder plugin for imbrgr video suite.
 * Inspired by pacNcap custom visual effects & analog tape filters.
 */

import type { VideoPlugin } from "@/lib/video-plugins/plugin-types";

export const vhsRetroPlugin: VideoPlugin = {
  metadata: {
    id: "pacncap_vhs_retro",
    name: "VHS Retro 90s",
    version: "1.0.0",
    author: "RASvibir / pacNcap",
    description: "Analog tape tracking, chromatic aberration, scanlines, and vintage color grading.",
    category: "filter",
  },
  requirements: {
    requiresWebGPU: false,
  },
  params: [
    { id: "intensity", label: "Effect Intensity", type: "number", default: 0.7, min: 0, max: 1, step: 0.1 },
    { id: "scanlines", label: "CRT Scanlines", type: "boolean", default: true },
  ],
  onFrameProcess(frameData, ctx, params) {
    if (ctx.performanceMode === "eco") return frameData;

    const intensity = typeof params?.intensity === "number" ? params.intensity : 0.7;
    const scanlines = params?.scanlines !== false;
    const { width, height, data } = frameData;
    const shift = Math.max(1, Math.round(3 * intensity));

    // Chromatic aberration (RGB shift)
    // Shift Red channel right by `shift`, Blue channel left by `shift`
    const copy = new Uint8ClampedArray(data);
    for (let y = 0; y < height; y++) {
      const isScanline = scanlines && y % 3 === 0;
      const scanDim = isScanline ? 1 - 0.25 * intensity : 1;

      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const rx = Math.min(width - 1, x + shift);
        const bx = Math.max(0, x - shift);
        const ri = (y * width + rx) * 4;
        const bi = (y * width + bx) * 4;

        // Apply shifted R & B, warm CRT curve
        data[i] = Math.min(255, Math.floor(copy[ri] * 1.05 * scanDim));
        data[i + 1] = Math.floor(copy[i + 1] * 0.98 * scanDim);
        data[i + 2] = Math.min(255, Math.floor(copy[bi] * 1.02 * scanDim));
      }
    }

    return frameData;
  },
};
