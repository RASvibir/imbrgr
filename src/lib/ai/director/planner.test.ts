import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PlannerFailedError,
  PlannerNotConfiguredError,
  cleanBrandName,
  extractJson,
  fitDurations,
  planStoryboard,
  plannerAvailable,
  resolvePlaceholders,
} from "./planner";
import { buildPlannerMessages } from "./prompt";
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

const slotted: Storyboard = {
  title: "[Brand] mugs",
  narration: "Start your day with a piece of art. [Brand]: where your coffee finds its home.",
  shots: [
    { durationSec: 4, caption: "Meet [Brand]", visualPrompt: "potter shaping clay, [Brand] studio", stockQuery: "[Brand] pottery", motion: "zoom-in" },
    { durationSec: 4, caption: "Fired to perfection", visualPrompt: "kiln glowing orange", stockQuery: "kiln firing", motion: "orbit" },
    { durationSec: 4, caption: "Your morning", visualPrompt: "steaming mug on a wooden table", stockQuery: "morning coffee", motion: "pan-right" },
  ],
};

describe("brand names and placeholders", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_MOCK", "");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("fills brand slots in text with the brand name and keeps it out of image and stock prompts", () => {
    const out = resolvePlaceholders(slotted, "Clay & Co");
    expect(out).not.toBeNull();
    expect(out!.title).toBe("Clay & Co mugs");
    expect(out!.narration).toContain("Clay & Co: where your coffee");
    expect(out!.shots[0].caption).toBe("Meet Clay & Co");
    expect(out!.shots[0].visualPrompt).toBe("potter shaping clay, the brand studio");
    expect(out!.shots[0].stockQuery).toBe("the brand pottery");
  });

  it("rejects a plan with unfilled slots when no brand name was given", () => {
    expect(resolvePlaceholders(slotted)).toBeNull();
  });

  it("rejects any other leftover template slot", () => {
    const odd = { ...goodBoard, narration: "Welcome, {{customer_name}}. The harbor wakes up slowly." };
    expect(resolvePlaceholders(odd, "Clay & Co")).toBeNull();
    expect(resolvePlaceholders({ ...goodBoard, title: "Harbor <company>" }, "Clay & Co")).toBeNull();
  });

  it("rejects a plan whose filled text would break the schema limits", () => {
    const longTitle = { ...slotted, title: "x".repeat(75) + " [Brand]" };
    expect(resolvePlaceholders(longTitle, "A".repeat(40))).toBeNull();
  });

  it("leaves finished plans untouched", () => {
    expect(resolvePlaceholders(goodBoard, "Clay & Co")).toEqual(goodBoard);
  });

  it("planStoryboard substitutes the brand and returns a finished plan", async () => {
    const p = provider("a", async () => JSON.stringify(slotted));
    const out = await planStoryboard({ prompt: "mug brand teaser", targetSec: 12, brandName: "Clay & Co" }, [p]);
    expect(out.storyboard.narration).toContain("Clay & Co");
    expect(JSON.stringify(out.storyboard)).not.toContain("[Brand]");
  });

  it("planStoryboard falls through to the next provider when the first leaves a slot", async () => {
    const templated = provider("templated", async () => JSON.stringify(slotted));
    const finished = provider("finished", async () => JSON.stringify(goodBoard));
    const out = await planStoryboard({ prompt: "mug brand teaser", targetSec: 12 }, [templated, finished]);
    expect(out.provider).toBe("finished");
  });

  it("fails when every provider leaves a slot", async () => {
    const templated = provider("templated", async () => JSON.stringify(slotted));
    await expect(planStoryboard({ prompt: "mug brand teaser", targetSec: 12 }, [templated])).rejects.toBeInstanceOf(
      PlannerFailedError,
    );
  });

  it("cleanBrandName strips characters that could break the prompt or look like a slot", () => {
    expect(cleanBrandName('  Clay "&"\nCo  ')).toBe("Clay & Co");
    expect(cleanBrandName("[Brand] {x} <y> `z`")).toBe("Brand x y z");
    expect(cleanBrandName("   ")).toBeUndefined();
    expect(cleanBrandName(undefined)).toBeUndefined();
    expect(cleanBrandName("a".repeat(100))).toHaveLength(40);
  });

  it("puts a sanitized brand name on its own line in the prompt, and omits it when absent", async () => {
    const withBrand = buildPlannerMessages({ prompt: "mugs", targetSec: 20, brandName: "Clay & Co" });
    expect(withBrand[1].content).toContain("Brand name: Clay & Co");
    const without = buildPlannerMessages({ prompt: "mugs", targetSec: 20 });
    expect(without[1].content).not.toContain("Brand name");
    expect(withBrand[0].content).toMatch(/Never write bracketed or templated placeholders/);
  });

  it("tells the model the real shot cap and how to write a visualPrompt", () => {
    const sys = buildPlannerMessages({ prompt: "mugs", targetSec: 20 })[0].content;
    expect(sys).toMatch(/Between 3 and 4 shots/);
    expect(sys).toMatch(/subject, action, setting, lighting/);
    expect(sys).toMatch(/ONE continuous piece/);
    expect(sys).toMatch(/same main subject words/);
  });

  it("passes the cleaned brand name to the provider", async () => {
    const p = provider("a", async () => JSON.stringify(goodBoard));
    await planStoryboard({ prompt: "mugs", targetSec: 12, brandName: 'Clay\n"Co"' }, [p]);
    const sent = (p.complete as ReturnType<typeof vi.fn>).mock.calls[0][0] as { content: string }[];
    expect(sent[1].content).toContain("Brand name: Clay Co");
  });
});
