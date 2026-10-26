import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PlannerFailedError,
  PlannerNotConfiguredError,
  extractJson,
  fitDurations,
  planStoryboard,
  plannerAvailable,
} from "./planner";
import type { PlannerProvider, Storyboard } from "./types";

const goodBoard: Storyboard = {
  title: "Sunrise over the harbor",
  narration: "The harbor wakes up slowly. Boats drift out. Gulls circle overhead.",
  shots: [
    { durationSec: 4, caption: "Dawn", visualPrompt: "harbor at dawn, soft light", stockQuery: "harbor sunrise", motion: "zoom-in" },
    { durationSec: 4, caption: "Boats", visualPrompt: "fishing boats leaving the harbor", stockQuery: "fishing boats", motion: "pan-right" },
    { durationSec: 4, caption: "Gulls", visualPrompt: "seagulls circling over water", stockQuery: "seagulls flying", motion: "zoom-out" },
  ],
};

function provider(name: string, impl: () => Promise<string>, configured = true): PlannerProvider {
  return { name, isConfigured: () => configured, complete: vi.fn(impl) };
}

describe("director planner (live path)", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_MOCK", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns a validated storyboard from a fenced JSON reply", async () => {
    const p = provider("a", async () => "Here you go:\n```json\n" + JSON.stringify(goodBoard) + "\n```");
    const out = await planStoryboard({ prompt: "harbor sunrise", targetSec: 12 }, [p]);
    expect(out.provider).toBe("a");
    expect(out.storyboard.shots).toHaveLength(3);
  });

  it("falls through to the next provider on invalid output or errors", async () => {
    const bad = provider("bad", async () => "not json at all");
    const boom = provider("boom", async () => {
      throw new Error("groq_http_429");
    });
    const good = provider("good", async () => JSON.stringify(goodBoard));
    const out = await planStoryboard({ prompt: "harbor sunrise", targetSec: 12 }, [bad, boom, good]);
    expect(out.provider).toBe("good");
  });

  it("rejects storyboards that trip the safety filter", async () => {
    const unsafe = { ...goodBoard, shots: [{ ...goodBoard.shots[0], visualPrompt: "nsfw scene" }, ...goodBoard.shots.slice(1)] };
    const p = provider("unsafe", async () => JSON.stringify(unsafe));
    await expect(planStoryboard({ prompt: "harbor", targetSec: 12 }, [p])).rejects.toBeInstanceOf(PlannerFailedError);
  });

  it("throws PlannerNotConfiguredError when no provider has credentials", async () => {
    const p = provider("none", async () => "{}", false);
    expect(plannerAvailable([p])).toBe(false);
    await expect(planStoryboard({ prompt: "harbor", targetSec: 12 }, [p])).rejects.toBeInstanceOf(
      PlannerNotConfiguredError,
    );
  });

  it("skips unconfigured providers", async () => {
    const skipped = provider("skipped", async () => JSON.stringify(goodBoard), false);
    const used = provider("used", async () => JSON.stringify(goodBoard));
    const out = await planStoryboard({ prompt: "harbor", targetSec: 12 }, [skipped, used]);
    expect(out.provider).toBe("used");
    expect(skipped.complete).not.toHaveBeenCalled();
  });
});

describe("director planner (mock mode)", () => {
  it("returns a deterministic storyboard in test mode", async () => {
    const out = await planStoryboard({ prompt: "a cat learns to surf", targetSec: 20 }, []);
    expect(out.provider).toBe("imbrgr-planner-mock");
    expect(out.storyboard.shots.length).toBeGreaterThanOrEqual(3);
    expect(plannerAvailable([])).toBe(true);
  });
});

describe("helpers", () => {
  it("extractJson finds the object inside prose", () => {
    expect(extractJson('sure! {"a":1} done')).toEqual({ a: 1 });
    expect(() => extractJson("nothing")).toThrow();
  });

  it("fitDurations scales to the target and keeps each shot within 1-10 s", () => {
    const fitted = fitDurations(goodBoard, 24);
    const total = fitted.shots.reduce((s, x) => s + x.durationSec, 0);
    expect(total).toBeCloseTo(24, 0);
    for (const s of fitted.shots) {
      expect(s.durationSec).toBeGreaterThanOrEqual(1);
      expect(s.durationSec).toBeLessThanOrEqual(10);
    }
  });
});
