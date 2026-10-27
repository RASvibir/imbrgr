import type { Storyboard } from "@/lib/ai/director/types";
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
    stockQuery: input.mature ? undefined : (s.stockQuery || stockQueryFromPrompt(s.visualPrompt)),
  }));
}
