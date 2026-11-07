import { describe, expect, it } from "vitest";
import {
  applyKitToPrompt,
  buildKitPromptExtras,
  parseKitPalette,
  palettePromptFragment,
} from "@/lib/kit-prompt";

describe("kit-prompt", () => {
  it("parses palette hex values", () => {
    expect(parseKitPalette({ primary: "#f97316", accents: ["#db2777", "nope"] })).toEqual({
      primary: "#f97316",
      secondary: undefined,
      accents: ["#db2777"],
    });
    expect(parseKitPalette({ primary: "orange" })).toBeNull();
  });

  it("builds style lock + palette fragment", () => {
    const extras = buildKitPromptExtras({
      name: "Scout",
      styleLock: "soft cel shading, oversized coat",
      paletteJson: { primary: "#f97316", secondary: "#1c1816" },
      stylePreset: "anime",
    });
    expect(extras.stylePreset).toBe("anime");
    expect(extras.fragment).toContain("soft cel shading");
    expect(extras.fragment).toContain("#f97316");
    expect(extras.fragment).toContain('kit "Scout"');
  });

  it("applies kit extras after the user prompt", () => {
    const next = applyKitToPrompt("hero posing on a rooftop", {
      styleLock: "consistent face, freckles",
      paletteJson: { primary: "#ea580c" },
      name: "Ember",
    });
    expect(next.startsWith("hero posing on a rooftop")).toBe(true);
    expect(next).toContain("consistent face");
    expect(palettePromptFragment({ primary: "#ea580c" })).toContain("#ea580c");
  });

  it("re-applies kit locks after an enhanced prompt rewrite", () => {
    const kit = {
      name: "Scout",
      styleLock: "soft cel shading, oversized coat",
      paletteJson: { primary: "#f97316" },
    };
    const enhanced = "a dramatic rooftop portrait with wind-swept hair, cinematic lighting";
    const finalPrompt = applyKitToPrompt(enhanced, kit);
    expect(finalPrompt).toContain("dramatic rooftop portrait");
    expect(finalPrompt).toContain("soft cel shading, oversized coat");
    expect(finalPrompt).toContain("#f97316");
    expect(finalPrompt).toContain('kit "Scout"');
  });
});
