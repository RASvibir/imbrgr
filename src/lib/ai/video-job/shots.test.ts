import { describe, expect, it } from "vitest";
import type { Storyboard } from "@/lib/ai/director/types";
import { MAX_JOB_SHOTS, planShots, stockQueryFromPrompt } from "./shots";
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
    expect(shots).toEqual([
      { durationSec: 13, visualPrompt: "neon burger", motion: "zoom-in", stockQuery: "neon burger" },
    ]);
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

describe("stock queries", () => {
  it("reduces a prompt to a few concrete keywords", () => {
    expect(stockQueryFromPrompt("Cinematic slow motion of a sizzling cheeseburger on a grill, 4k")).toBe(
      "sizzling cheeseburger grill",
    );
  });

  it("returns undefined when nothing is left", () => {
    expect(stockQueryFromPrompt("the a of")).toBeUndefined();
  });

  it("never sets a stock query for mature jobs", () => {
    const shots = planShots({ ...base, mature: true, prompt: "grill party" }, null);
    expect(shots[0].stockQuery).toBeUndefined();
  });

  it("fills a missing storyboard stock query from the shot prompt", () => {
    const sb = storyboard([5, 8]);
    sb.shots[0].stockQuery = "";
    sb.shots[0].visualPrompt = "sizzling cheeseburger";
    const shots = planShots(base, sb);
    expect(shots[0].stockQuery).toBe("sizzling cheeseburger");
    expect(shots[1].stockQuery).toBe("q1");
  });
});
