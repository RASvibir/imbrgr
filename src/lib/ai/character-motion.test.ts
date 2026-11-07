import { describe, expect, it } from "vitest";
import {
  CHARACTER_MOTIONS,
  CHARACTER_MOTION_PHRASE,
  characterMotionPhrase,
  isCharacterMotion,
} from "./character-motion";

describe("character motion presets", () => {
  it("exposes idle, walk, and emote with prompt phrases", () => {
    expect(CHARACTER_MOTIONS.map((m) => m.id)).toEqual(["idle", "walk", "emote"]);
    for (const m of CHARACTER_MOTIONS) {
      expect(CHARACTER_MOTION_PHRASE[m.id].length).toBeGreaterThan(20);
      expect(characterMotionPhrase(m.id)).toBe(m.promptPhrase);
    }
  });

  it("narrows ids safely", () => {
    expect(isCharacterMotion("idle")).toBe(true);
    expect(isCharacterMotion("zoom-in")).toBe(false);
    expect(isCharacterMotion(undefined)).toBe(false);
  });

  it("keeps public labels free of game / product pitch words", () => {
    const blob = CHARACTER_MOTIONS.map((m) => `${m.label} ${m.description} ${m.promptPhrase}`).join(
      " ",
    );
    expect(blob).not.toMatch(/heyumps|cutscene|sprite|rpg|npc/i);
  });
});
