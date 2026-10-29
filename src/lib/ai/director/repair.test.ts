import { describe, expect, it } from "vitest";
import { repairStoryboard } from "./repair";
import { storyboardSchema } from "./types";

const params = { prompt: "neon burger", targetSec: 12 };

describe("repairStoryboard", () => {
  it("fixes invented motions, missing captions and stock queries so the plan validates", () => {
    const fixed = repairStoryboard(
      {
        title: "Burger",
        narration: "A burger.",
        shots: [
          { durationSec: "4", caption: "", visualPrompt: "a sizzling burger on a grill", motion: "Slow Zoom In" },
          { durationSec: 4, caption: "c", visualPrompt: "neon sign over a diner", stockQuery: "diner", motion: "tracking shot" },
          { caption: "end", visualPrompt: "burger close up", motion: "???" },
        ],
      },
      params,
    );
    const parsed = storyboardSchema.safeParse(fixed);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.shots.map((s) => s.motion)).toEqual(["zoom-in", "pan-right", "orbit"]);
    expect(parsed.data.shots[0].caption).toBe("Shot 1");
    expect(parsed.data.shots[0].stockQuery).toBe("sizzling burger grill");
    expect(parsed.data.shots[0].durationSec).toBe(4);
    expect(parsed.data.shots[2].durationSec).toBe(4);
  });

  it("does not invent a scene: a shot without a visualPrompt stays invalid", () => {
    const fixed = repairStoryboard({ title: "t", narration: "n", shots: [{ caption: "c", motion: "orbit" }] }, params);
    expect(storyboardSchema.safeParse(fixed).success).toBe(false);
  });

  it("passes non-storyboard input through untouched", () => {
    expect(repairStoryboard("nope", params)).toBe("nope");
    expect(repairStoryboard({ shots: [] }, params)).toEqual({ shots: [] });
  });

  it("keeps the last shot when there are too many", () => {
    const shots = Array.from({ length: 15 }, (_, i) => ({ caption: "c", visualPrompt: `scene ${i}`, motion: "orbit" }));
    const out = repairStoryboard({ title: "t", narration: "n", shots }, params) as { shots: { visualPrompt: string }[] };
    expect(out.shots).toHaveLength(12);
    expect(out.shots[11].visualPrompt).toBe("scene 14");
  });

  it("keeps look and action when present and never invents them", () => {
    const withBoth = repairStoryboard(
      { title: "t", narration: "n", look: " neon bar ", shots: [{ caption: "c", visualPrompt: "a burger", motion: "orbit", action: " steam rises " }] },
      params,
    ) as { look?: string; shots: { action?: string }[] };
    expect(withBoth.look).toBe("neon bar");
    expect(withBoth.shots[0].action).toBe("steam rises");
    const without = repairStoryboard({ title: "t", narration: "n", shots: [{ caption: "c", visualPrompt: "a burger", motion: "orbit" }] }, params) as { look?: string; shots: { action?: string }[] };
    expect(without.look).toBeUndefined();
    expect(without.shots[0].action).toBeUndefined();
  });
});
