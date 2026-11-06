import { describe, expect, it } from "vitest";
import {
  analyzeVideoPromptStructure,
  enrichVideoPromptLocal,
  needsVideoPromptEnrichment,
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

  it("flags thin prompts as needing enrichment", () => {
    for (const prompt of THIN_FIXTURES) {
      expect(needsVideoPromptEnrichment(prompt), prompt).toBe(true);
      expect(analyzeVideoPromptStructure(prompt).score, prompt).toBeLessThan(3);
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

  it("leaves already-structured prompts alone", () => {
    const rich =
      "barista pouring latte art, creamy swirl forming, sunlit café, gentle tilt-down, soft window light, shallow depth of field";
    expect(enrichVideoPromptLocal(rich)).toBe(rich);
  });
});

describe("video prompt examples + system prompt fixtures", () => {
  it("ships example starters that themselves clear the quality bar", () => {
    expect(VIDEO_PROMPT_EXAMPLES.length).toBeGreaterThanOrEqual(3);
    for (const ex of VIDEO_PROMPT_EXAMPLES) {
      expect(analyzeVideoPromptStructure(ex.prompt).score, ex.label).toBeGreaterThanOrEqual(3);
    }
  });

  it("keeps the enhance system prompt structured for free models", () => {
    expect(VIDEO_ENHANCE_SYSTEM).toMatch(/camera move/i);
    expect(VIDEO_ENHANCE_SYSTEM).toMatch(/lighting/i);
    expect(VIDEO_ENHANCE_SYSTEM).toMatch(/max 55 words/i);
    expect(VIDEO_ENHANCE_SYSTEM).toMatch(/Output only the prompt/i);
  });
});
