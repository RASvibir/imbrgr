import { describe, expect, it } from "vitest";
import type { Storyboard } from "@/lib/ai/director/types";
import { MAX_JOB_SHOTS, planShots } from "./shots";
import type { JobInput } from "./types";

const base: JobInput = {
  prompt: "neon burger",
  aspectRatio: "16:9",
  mode: "video",
  durationSec: 13,
  motion: "zoom-in",
  seed: 1,
  mature: false,
};

function storyboard(durations: number[]): Storyboard {
  return {
    title: "t",
    narration: "n",
    shots: durations.map((durationSec, i) => ({
      durationSec,
      caption: `c${i}`,
      visualPrompt: `scene ${i}`,
      stockQuery: `q${i}`,
      motion: "pan-right" as const,
    })),
  };
}

const total = (shots: { durationSec: number }[]) =>
  Math.round(shots.reduce((a, s) => a + s.durationSec, 0) * 10) / 10;

describe("planShots", () => {
  it("returns one shot without a storyboard", () => {
    const shots = planShots(base, null);
    expect(shots).toEqual([{ durationSec: 13, visualPrompt: "neon burger", motion: "zoom-in" }]);
  });

  it("returns one shot for a gif even with a storyboard", () => {
    const shots = planShots({ ...base, mode: "gif", durationSec: 3 }, storyboard([5, 5, 5]));
    expect(shots).toHaveLength(1);
    expect(shots[0].durationSec).toBe(3);
  });

  it("rescales storyboard shots to the target total", () => {
    const shots = planShots(base, storyboard([3, 4, 5, 2]));
    expect(shots).toHaveLength(4);
    expect(total(shots)).toBe(13);
    expect(shots.every((s) => s.durationSec >= 1)).toBe(true);
    expect(shots[0].motion).toBe("pan-right");
  });

  it("caps at the maximum shot count", () => {
    const shots = planShots(base, storyboard([2, 2, 2, 2, 2, 2]));
    expect(shots).toHaveLength(MAX_JOB_SHOTS);
    expect(total(shots)).toBe(13);
  });

  it("falls back to an even split when a shot would drop under 1 s", () => {
    const shots = planShots({ ...base, durationSec: 5 }, storyboard([1, 1, 1, 10]));
    expect(total(shots)).toBe(5);
    expect(shots.every((s) => s.durationSec >= 1)).toBe(true);
  });
});
