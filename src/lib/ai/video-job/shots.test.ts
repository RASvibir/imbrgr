import { describe, expect, it } from "vitest";
import type { Storyboard } from "@/lib/ai/director/types";
import { MAX_JOB_SHOTS, pickShots, planGpuShots, planShots, stockQueryFromPrompt, stockQueryLadder } from "./shots";
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

  it("keeps the closing shot when trimming a long storyboard", () => {
    const shots = planShots(base, storyboard([2, 2, 2, 2, 2, 2]));
    expect(shots.map((s) => s.visualPrompt.split(", ").pop())).toEqual(["scene 0", "scene 1", "scene 2", "scene 5"]);
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

describe("planGpuShots", () => {
  it("chains 13 s into 3 clips on a 5 s backend", () => {
    const shots = planGpuShots(base, null, 5);
    expect(shots).toHaveLength(3);
    expect(shots.every((s) => s.durationSec === 4.33)).toBe(true);
    expect(shots[0].visualPrompt).toContain("neon burger");
    expect(shots[0].visualPrompt).not.toMatch(/^Continuing/);
    expect(shots[1].visualPrompt).toMatch(/^Continuing from the previous frame/);
    expect(shots.every((s) => s.motion === "zoom-in")).toBe(true);
  });

  it("uses storyboard prompts per clip when available", () => {
    const shots = planGpuShots(base, storyboard([4, 4, 5]), 5);
    expect(shots[0].visualPrompt).toContain("scene 0");
    expect(shots[1].visualPrompt).toContain("scene 1");
    expect(shots[2].visualPrompt).toContain("scene 2");
  });

  it("uses each storyboard shot's own motion", () => {
    const shots = planGpuShots(base, storyboard([4, 4, 5]), 5);
    expect(shots.every((s) => s.motion === "pan-right")).toBe(true);
    expect(shots[0].visualPrompt).toContain("pan to the right");
  });

  it("keeps the closing storyboard shot when the board is longer than the chain", () => {
    const shots = planGpuShots(base, storyboard([2, 2, 2, 2, 2, 2]), 5);
    expect(shots).toHaveLength(3);
    expect(shots[2].visualPrompt).toContain("scene 5");
  });

  it("uses a single clip for a short gif", () => {
    expect(planGpuShots({ ...base, mode: "gif", durationSec: 3 }, null, 5)).toHaveLength(1);
  });
});

describe("pickShots", () => {
  it("returns the list unchanged when it fits", () => {
    expect(pickShots([1, 2, 3], 4)).toEqual([1, 2, 3]);
  });

  it("keeps the first N-1 and the last", () => {
    expect(pickShots([1, 2, 3, 4, 5, 6], 4)).toEqual([1, 2, 3, 6]);
    expect(pickShots([1, 2, 3], 1)).toEqual([3]);
  });
});

describe("stockQueryLadder", () => {
  it("goes from specific to broad without duplicates", () => {
    expect(stockQueryLadder("sizzling cheeseburger grill")).toEqual([
      "sizzling cheeseburger grill",
      "sizzling cheeseburger",
      "sizzling",
    ]);
    expect(stockQueryLadder("burger")).toEqual(["burger"]);
    expect(stockQueryLadder("  ")).toEqual([]);
  });
});

describe("continuity anchors", () => {
  const board = { ...storyboard([4, 4, 5]), look: "a neon burger bar at night, magenta and teal light" };
  const withAction = {
    ...board,
    shots: board.shots.map((s, i) => ({ ...s, action: `steam rises ${i}` })),
  };

  it("puts the shared look and a shot-scale ladder into every still", () => {
    const shots = planShots(base, board);
    expect(shots.every((s) => s.visualPrompt.includes("neon burger bar at night"))).toBe(true);
    expect(shots[0].visualPrompt.startsWith("wide establishing shot")).toBe(true);
    expect(shots[2].visualPrompt.startsWith("close-up")).toBe(true);
  });

  it("does not double up a look the scene already contains", () => {
    const b = { ...board, shots: board.shots.map((s) => ({ ...s, visualPrompt: `${board.look}, grill` })) };
    const text = planShots(base, b)[0].visualPrompt;
    expect(text.match(/neon burger bar/g)).toHaveLength(1);
  });

  it("chained GPU clips only say what moves, first clip carries the full scene", () => {
    const shots = planGpuShots(base, withAction, 5);
    expect(shots[0].visualPrompt).toContain("neon burger bar at night");
    expect(shots[0].visualPrompt).toContain("steam rises 0");
    expect(shots[1].visualPrompt).toBe("Continuing from the previous frame: steam rises 1, smooth camera pan to the right");
    expect(shots[1].visualPrompt).not.toContain("neon burger bar");
  });

  it("works without look or action (small models)", () => {
    const shots = planGpuShots(base, storyboard([4, 4, 5]), 5);
    expect(shots[1].visualPrompt).toMatch(/^Continuing from the previous frame, same subject and setting, now scene 1/);
  });
});
