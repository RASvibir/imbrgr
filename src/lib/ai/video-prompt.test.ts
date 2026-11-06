import { describe, expect, it } from "vitest";
import {
  analyzeVideoPromptStructure,
  enrichVideoPromptLocal,
  needsVideoPromptEnrichment,
  promptHasCameraMove,
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

  it("does not overwrite camera language the user already wrote", () => {
    const withPan = "burger on a grill, steam rising, neon alley, smooth pan right, warm light, macro";
    expect(enrichVideoPromptLocal(withPan, { motion: "orbit" })).toBe(withPan);
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
