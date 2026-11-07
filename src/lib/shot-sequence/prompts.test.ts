import { describe, expect, it } from "vitest";
import { buildBeatPrompt, framingHintForRole } from "./prompts";
import type { ShotBeat } from "./types";

const beat: ShotBeat = {
  id: "abc12345",
  role: "action",
  caption: "Go",
  visualPrompt: "a runner on a coastal path",
  action: "runner sprints past",
  motion: "pan-right",
  durationSec: 4,
  sortOrder: 1,
};

describe("buildBeatPrompt", () => {
  it("includes look and kit fragment for continuity", () => {
    const out = buildBeatPrompt(beat, {
      look: "coastal dawn, soft gold light",
      kitFragment: 'consistent character from kit "Runner"',
      stylePresetSuffix: "cinematic film look",
    });
    expect(out).toContain("a runner on a coastal path");
    expect(out).toContain("continuity look: coastal dawn");
    expect(out).toContain("kit \"Runner\"");
    expect(out).toContain("action: runner sprints past");
    expect(out).toContain("cinematic film look");
  });

  it("works with just the visual prompt", () => {
    expect(buildBeatPrompt(beat)).toBe("a runner on a coastal path. action: runner sprints past");
  });
});

describe("framingHintForRole", () => {
  it("returns role-specific hints", () => {
    expect(framingHintForRole("establishing")).toMatch(/Wide/i);
    expect(framingHintForRole("closeup")).toMatch(/close-up/i);
  });
});
