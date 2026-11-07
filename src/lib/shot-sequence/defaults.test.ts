import { describe, expect, it } from "vitest";
import { defaultBeats, defaultLook } from "./defaults";
import { beatsSchema } from "./types";

describe("defaultBeats", () => {
  it("returns establishing → action → close-up", () => {
    const beats = defaultBeats("ember grill");
    expect(beats.map((b) => b.role)).toEqual(["establishing", "action", "closeup"]);
    expect(beatsSchema.safeParse(beats).success).toBe(true);
    expect(new Set(beats.map((b) => b.id)).size).toBe(3);
  });

  it("embeds the seed in prompts", () => {
    const beats = defaultBeats("neon ramen stall");
    expect(beats.every((b) => b.visualPrompt.includes("neon ramen stall"))).toBe(true);
  });
});

describe("defaultLook", () => {
  it("mentions the seed subject", () => {
    expect(defaultLook("neon ramen stall")).toContain("neon ramen stall");
  });
});
