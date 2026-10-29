import { PLAN_MOTIONS, type PlanParams } from "./types";

const FALLBACK_MOTIONS = ["zoom-in", "pan-right", "orbit", "zoom-out"] as const;
const MOTION_HINTS: [RegExp, (typeof PLAN_MOTIONS)[number]][] = [
  [/pan.*left|left/, "pan-left"],
  [/pan.*right|right|pan|track|slide/, "pan-right"],
  [/zoom.?out|pull|reveal|wide/, "zoom-out"],
  [/zoom|push|dolly|close/, "zoom-in"],
  [/orbit|rotate|circle|spin|around/, "orbit"],
  [/pulse|beat|flash|throb/, "pulse"],
  [/drama|bold|intense|dynamic|shake/, "dramatic"],
];

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim() : "");

function repairMotion(raw: unknown, index: number): string {
  const key = str(raw).toLowerCase().replace(/[_\s]+/g, "-");
  if ((PLAN_MOTIONS as readonly string[]).includes(key)) return key;
  const loose = key.replace(/-/g, " ");
  const hit = MOTION_HINTS.find(([re]) => re.test(loose));
  return hit ? hit[1] : FALLBACK_MOTIONS[index % FALLBACK_MOTIONS.length];
}

function keywords(text: string, maxWords: number): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, maxWords)
    .join(" ");
}

/**
 * Small free models often get one field slightly wrong (an invented motion name, a missing caption or
 * stock query, a number as a string). Fix those cheaply instead of discarding the whole plan.
 * Never invents the scene itself: a shot without a visualPrompt stays invalid.
 */
export function repairStoryboard(raw: unknown, params: Pick<PlanParams, "prompt" | "targetSec">): unknown {
  if (!isObj(raw) || !Array.isArray(raw.shots)) return raw;
  const shotsIn = raw.shots.filter(isObj);
  if (shotsIn.length === 0) return raw;
  const picked = shotsIn.length > 12 ? [...shotsIn.slice(0, 11), shotsIn[shotsIn.length - 1]] : shotsIn;
  const perShot = params.targetSec / picked.length;

  const shots = picked.map((s, i) => {
    const visualPrompt = str(s.visualPrompt ?? s.visual_prompt ?? s.prompt).slice(0, 300);
    const dur = Number(s.durationSec ?? s.duration);
    return {
      durationSec: Number.isFinite(dur) && dur > 0 ? Math.min(10, Math.max(1, dur)) : Math.min(10, Math.max(1, perShot)),
      caption: (str(s.caption) || str(s.text) || `Shot ${i + 1}`).slice(0, 140),
      visualPrompt,
      stockQuery: (str(s.stockQuery ?? s.stock_query) || keywords(visualPrompt, 4)).slice(0, 60),
      motion: repairMotion(s.motion ?? s.camera, i),
    };
  });

  const topic = str(params.prompt).slice(0, 80);
  const narration = str(raw.narration) || shots.map((s) => s.caption).join(". ");
  return {
    title: (str(raw.title) || topic).slice(0, 80),
    narration: narration.slice(0, 1200),
    shots,
  };
}
