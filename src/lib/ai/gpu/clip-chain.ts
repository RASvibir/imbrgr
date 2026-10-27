/** Ported from pacNcap packages/video-tools/src/ai/backends.ts (planClipChain). */

export type ClipPlan = {
  index: number;
  startSec: number;
  durationSec: number;
  seedFrom: "prompt" | "previous-last-frame";
};

export type ClipChain = { clips: ClipPlan[]; totalSec: number; fits: boolean };

/** Split `targetSec` into equal clips no longer than `maxClipSec`, chained by last frame. */
export function planClipChain(targetSec: number, maxClipSec: number, maxClips = 4): ClipChain {
  if (!(targetSec > 0) || !(maxClipSec > 0)) return { clips: [], totalSec: 0, fits: false };
  const needed = Math.ceil(targetSec / maxClipSec - 1e-9);
  const count = Math.min(needed, maxClips);
  const each = Math.round((Math.min(targetSec, count * maxClipSec) / count) * 100) / 100;
  const clips = Array.from({ length: count }, (_, i) => ({
    index: i,
    startSec: Math.round(i * each * 100) / 100,
    durationSec: each,
    seedFrom: (i === 0 ? "prompt" : "previous-last-frame") as ClipPlan["seedFrom"],
  }));
  return { clips, totalSec: Math.round(each * count * 100) / 100, fits: needed <= maxClips };
}
