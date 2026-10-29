import type { Storyboard } from "@/lib/ai/director/types";
import { planClipChain } from "@/lib/ai/gpu/clip-chain";
import { composeGpuPrompt, composeShotText, shotScaleFor } from "./compose";
import type { JobInput, JobShot } from "./types";

export const MAX_JOB_SHOTS = 4;

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "of", "in", "on", "at", "to", "for", "with", "by", "from", "into", "over",
  "is", "are", "its", "it", "my", "our", "your", "this", "that", "some", "very", "while", "as",
  "cinematic", "slow", "motion", "shot", "video", "footage", "scene", "close", "up", "closeup", "4k", "hd",
  "dramatic", "beautiful", "stunning", "amazing", "high", "quality", "smooth", "camera",
]);

/** Short keyword query for stock search: a few concrete nouns beat a full prompt sentence. */
export function stockQueryFromPrompt(prompt: string, maxWords = 4): string | undefined {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  const unique = [...new Set(words)].slice(0, maxWords);
  const query = unique.join(" ").slice(0, 100).trim();
  return query || undefined;
}

/** Specific to broad: the full query, its first two words, then its first word (max 3 searches). */
export function stockQueryLadder(query: string): string[] {
  const words = query.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const rungs = [words.join(" "), words.slice(0, 2).join(" "), words[0]];
  return [...new Set(rungs)];
}

/** Keeps the first N-1 shots plus the closer, so the payoff shot is never the one dropped. */
export function pickShots<T>(shots: T[], max: number): T[] {
  if (shots.length <= max) return shots;
  if (max <= 1) return shots.slice(-1);
  return [...shots.slice(0, max - 1), shots[shots.length - 1]];
}

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
    return [
      {
        durationSec: total,
        visualPrompt: input.prompt,
        motion: input.motion,
        stockQuery: input.mature ? undefined : stockQueryFromPrompt(input.prompt),
      },
    ];
  }
  const picked = pickShots(storyboard.shots, MAX_JOB_SHOTS);
  const sum = picked.reduce((acc, s) => acc + s.durationSec, 0);
  let durations = picked.map((s) => round1((s.durationSec * total) / sum));
  const head = durations.slice(0, -1).reduce((acc, d) => acc + d, 0);
  durations[durations.length - 1] = round1(total - head);
  if (durations.some((d) => d < 1)) durations = splitEvenly(total, picked.length);
  return picked.map((s, i) => ({
    durationSec: durations[i],
    visualPrompt: composeShotText({
      visualPrompt: s.visualPrompt,
      look: storyboard.look,
      scale: shotScaleFor(i, picked.length),
    }),
    motion: s.motion,
    caption: s.caption,
    stockQuery: input.mature ? undefined : (s.stockQuery || stockQueryFromPrompt(s.visualPrompt)),
  }));
}

/** Clip-by-clip plan for a generative backend: each clip continues from the previous clip's last frame. */
export function planGpuShots(input: JobInput, storyboard: Storyboard | null, maxClipSec: number): JobShot[] {
  const chain = planClipChain(input.durationSec, maxClipSec, MAX_JOB_SHOTS);
  const board = pickShots(storyboard?.shots ?? [], chain.clips.length);
  return chain.clips.map((clip, i) => {
    const shot = board[i];
    const motion = shot?.motion ?? input.motion;
    return {
      durationSec: clip.durationSec,
      visualPrompt: composeGpuPrompt({
        visualPrompt: shot?.visualPrompt ?? input.prompt,
        look: storyboard?.look,
        action: shot?.action,
        scale: shot ? shotScaleFor(i, chain.clips.length) : undefined,
        motion,
        style: input.style,
        continuation: i > 0 || Boolean(input.parentJobId),
      }),
      motion,
      caption: shot?.caption,
    };
  });
}
