import { describe, expect, it } from "vitest";
import {
  analyzeVideoPromptStructure,
  enrichVideoPromptLocal,
  needsVideoPromptEnrichment,
  promptHasCameraMove,
  promptHasSubjectMotion,
  VIDEO_ENHANCE_SYSTEM,
  VIDEO_PROMPT_EXAMPLES,
} from "./video-prompt";

/** Evaluation fixtures: thin free-tier inputs should reach structure score ≥ 3 after local enrich. */
const THIN_FIXTURES = [
  "sunset burger",
  "cat on a windowsill",
  "city at night",
  "pouring coffee",
  "cinematic neon street",
  "aerial neon city",
] as const;

describe("video prompt structure analysis", () => {
  it("scores rich cinematic language highly", () => {
    const rich =
      "smashed burger searing on cast iron, steam rising, neon alley at night, slow push-in, warm rim light, macro lens";
    const s = analyzeVideoPromptStructure(rich);
    expect(s.hasMotion).toBe(true);
    expect(s.hasCamera).toBe(true);
    expect(s.hasLighting).toBe(true);
    expect(s.hasFraming).toBe(true);
    expect(s.score).toBe(4);
  });

  it("does not double-count shared framing terms as camera moves", () => {
    const aerial = analyzeVideoPromptStructure("aerial neon city");
    expect(aerial.hasFraming).toBe(true);
    expect(aerial.hasLighting).toBe(true);
    expect(aerial.hasCamera).toBe(false);
    expect(aerial.hasMotion).toBe(false);
    expect(aerial.score).toBe(2);
    expect(needsVideoPromptEnrichment("aerial neon city")).toBe(true);

    const macro = analyzeVideoPromptStructure("macro neon burger");
    expect(macro.hasFraming).toBe(true);
    expect(macro.hasCamera).toBe(false);
  });

  it("flags thin prompts as needing enrichment", () => {
    for (const prompt of THIN_FIXTURES) {
      expect(needsVideoPromptEnrichment(prompt), prompt).toBe(true);
    }
  });
});

describe("enrichVideoPromptLocal (zero-token free tier)", () => {
  it("lifts every thin fixture to structure score ≥ 3 without dropping the subject", () => {
    for (const prompt of THIN_FIXTURES) {
      const out = enrichVideoPromptLocal(prompt);
      expect(out.toLowerCase()).toContain(prompt.toLowerCase().split(/\s+/)[0]!);
      expect(analyzeVideoPromptStructure(out).score, `${prompt} → ${out}`).toBeGreaterThanOrEqual(3);
      expect(out.length).toBeLessThanOrEqual(500);
    }
  });

  it("does not invent a default push-in when no motion is selected", () => {
    const out = enrichVideoPromptLocal("sunset burger");
    expect(out).not.toMatch(/push-in/i);
    expect(promptHasCameraMove(out)).toBe(false);
  });

  it("respects selected Camera Motion instead of stacking a conflicting move", () => {
    const out = enrichVideoPromptLocal("sunset burger", { motion: "orbit" });
    expect(out).toMatch(/orbital camera drift/i);
    expect(out).not.toMatch(/push-in/i);
    expect(promptHasCameraMove(out)).toBe(true);
  });

  it("uses character motion presets instead of generic subject motion", () => {
    const out = enrichVideoPromptLocal("hero in a raincoat", { characterMotion: "walk" });
    expect(out).toMatch(/walking forward|looping gait/i);
    expect(out).not.toMatch(/gentle natural motion/i);
  });

  it("detects already-injected character motion phrases so they are not restacked", () => {
    const withEmote = enrichVideoPromptLocal("hero in a raincoat", { characterMotion: "emote" });
    expect(promptHasSubjectMotion(withEmote)).toBe(true);
    expect(enrichVideoPromptLocal(withEmote, { characterMotion: "emote" })).toBe(withEmote);
  });

  it("does not overwrite camera language the user already wrote", () => {
    const withPan = "burger on a grill, steam rising, neon alley, smooth pan right, warm light, macro";
    expect(enrichVideoPromptLocal(withPan, { motion: "orbit" })).toBe(withPan);
  });

  it("detects an injected pulse phrase so enrich does not duplicate it", () => {
    const withPulse = enrichVideoPromptLocal("sunset burger", { motion: "pulse" });
    expect(promptHasCameraMove(withPulse)).toBe(true);
    expect(enrichVideoPromptLocal(withPulse, { motion: "pulse" })).toBe(withPulse);
    expect(withPulse.match(/scale pulse/gi)?.length ?? 0).toBe(1);
  });

  it("does not treat windowsill or flower as subject motion", () => {
    expect(analyzeVideoPromptStructure("cat on a windowsill").hasMotion).toBe(false);
    expect(analyzeVideoPromptStructure("flower vase on a table").hasMotion).toBe(false);
    expect(needsVideoPromptEnrichment("cat on a windowsill")).toBe(true);
    expect(enrichVideoPromptLocal("cat on a windowsill")).toMatch(/natural motion/i);
  });

  it("does not treat food truck or pan-fried as camera moves", () => {
    expect(promptHasCameraMove("food truck neon alley")).toBe(false);
    expect(promptHasCameraMove("pan-fried smashed burger")).toBe(false);
    const out = enrichVideoPromptLocal("food truck neon alley", { motion: "orbit" });
    expect(out).toMatch(/orbital camera drift/i);
  });

  it("detects hyphenated pan/tilt moves so enrich does not stack another camera", () => {
    expect(promptHasCameraMove("burger sizzle, pan-left, neon night")).toBe(true);
    expect(promptHasCameraMove("burger sizzle, tilt-up, neon night")).toBe(true);
    const withPanLeft = "burger on a grill, steam rising, neon alley, pan-left, warm light, macro";
    expect(enrichVideoPromptLocal(withPanLeft, { motion: "orbit" })).toBe(withPanLeft);
  });

  it("leaves already-structured prompts alone", () => {
    const rich =
      "barista pouring latte art, creamy swirl forming, sunlit café, soft window light, shallow depth of field";
    expect(enrichVideoPromptLocal(rich)).toBe(rich);
  });
});

describe("video prompt examples + system prompt fixtures", () => {
  it("ships example starters that themselves clear the quality bar without baking a camera move", () => {
    expect(VIDEO_PROMPT_EXAMPLES.length).toBeGreaterThanOrEqual(3);
    for (const ex of VIDEO_PROMPT_EXAMPLES) {
      expect(analyzeVideoPromptStructure(ex.prompt).score, ex.label).toBeGreaterThanOrEqual(3);
      expect(promptHasCameraMove(ex.prompt), ex.label).toBe(false);
    }
  });

  it("keeps the enhance system prompt from inventing conflicting camera moves", () => {
    expect(VIDEO_ENHANCE_SYSTEM).toMatch(/Do NOT invent a camera move/i);
    expect(VIDEO_ENHANCE_SYSTEM).toMatch(/lighting/i);
    expect(VIDEO_ENHANCE_SYSTEM).toMatch(/max 55 words/i);
    expect(VIDEO_ENHANCE_SYSTEM).toMatch(/Output only the prompt/i);
  });
});
