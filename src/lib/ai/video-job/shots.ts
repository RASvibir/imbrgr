import type { Storyboard } from "@/lib/ai/director/types";
import type { JobInput, JobShot } from "./types";

export const MAX_JOB_SHOTS = 4;

const round1 = (n: number) => Math.round(n * 10) / 10;

function splitEvenly(total: number, count: number): number[] {
  const per = round1(total / count);
  const out = Array.from({ length: count }, () => per);
  out[count - 1] = round1(total - per * (count - 1));
  return out;
}

/** One shot for a GIF or when no storyboard is available; otherwise 1-4 storyboard shots summing to the target. */
export function planShots(input: JobInput, storyboard: Storyboard | null): JobShot[] {
  const total = input.durationSec;
  if (!storyboard || input.mode === "gif" || storyboard.shots.length === 0) {
    return [{ durationSec: total, visualPrompt: input.prompt, motion: input.motion }];
  }
  const picked = storyboard.shots.slice(0, MAX_JOB_SHOTS);
  const sum = picked.reduce((acc, s) => acc + s.durationSec, 0);
  let durations = picked.map((s) => round1((s.durationSec * total) / sum));
  const head = durations.slice(0, -1).reduce((acc, d) => acc + d, 0);
  durations[durations.length - 1] = round1(total - head);
  if (durations.some((d) => d < 1)) durations = splitEvenly(total, picked.length);
  return picked.map((s, i) => ({
    durationSec: durations[i],
    visualPrompt: s.visualPrompt,
    motion: s.motion,
    caption: s.caption,
    stockQuery: s.stockQuery,
  }));
}
