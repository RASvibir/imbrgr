import { describe, expect, it } from "vitest";
import { exportSequence, fitStoryboardVisualPrompt, toClipPack, toStoryboard } from "./export";
import { defaultBeats, defaultLook } from "./defaults";
import type { ShotBeat } from "./types";

const source = {
  shortId: "seq12345",
  title: "Coastal run",
  look: defaultLook("a runner at dawn"),
  narration: "Dawn on the coast. One last push.",
  aspectRatio: "16:9",
  stylePreset: "cinematic",
  kitShortId: null as string | null,
  beats: defaultBeats("a runner at dawn"),
  kitFragment: null as string | null,
  stylePresetSuffix: "cinematic lighting",
};

describe("shot sequence export", () => {
  it("exports a director-compatible storyboard", () => {
    const board = toStoryboard(source);
    expect(board.title).toBe("Coastal run");
    expect(board.shots).toHaveLength(3);
    expect(board.shots[0]!.motion).toBe("zoom-out");
    expect(board.shots.every((s) => s.visualPrompt.includes("continuity look"))).toBe(true);
    expect(board.look).toContain("a runner at dawn");
  });

  it("never drops the beat when kit+style overrun the budget", () => {
    const beat: ShotBeat = {
      ...source.beats[0]!,
      visualPrompt: "a runner on the coastal path at dawn",
    };
    const prompt = fitStoryboardVisualPrompt(beat, {
      look: "L".repeat(400),
      kitFragment: "K".repeat(280),
      stylePresetSuffix: "S".repeat(280),
    });
    expect(prompt.length).toBeLessThanOrEqual(300);
    expect(prompt.startsWith("a runner on the coastal path at dawn")).toBe(true);
    expect(prompt).toContain("a runner on the coastal path at dawn");
  });

  it("appends kit before look/style when the beat leaves room", () => {
    const beat: ShotBeat = {
      ...source.beats[0]!,
      visualPrompt: "a runner on the path",
    };
    const prompt = fitStoryboardVisualPrompt(beat, {
      look: "shared coastal dawn palette",
      kitFragment: "kit Runner lock",
      stylePresetSuffix: "cinematic lighting",
    });
    expect(prompt.length).toBeLessThanOrEqual(300);
    expect(prompt).toContain("a runner on the path");
    expect(prompt).toContain("kit Runner lock");
    expect(prompt).toContain("continuity look: shared coastal dawn palette");
    expect(prompt).toContain("cinematic lighting");
    expect(prompt.indexOf("kit Runner lock")).toBeLessThan(prompt.indexOf("continuity look:"));
  });

  it("truncates look before dropping kit when space is tight", () => {
    const beat: ShotBeat = {
      ...source.beats[0]!,
      visualPrompt: "short beat",
    };
    const prompt = fitStoryboardVisualPrompt(beat, {
      look: "L".repeat(400),
      kitFragment: "kit Runner lock must survive",
      stylePresetSuffix: "cinematic lighting",
    });
    expect(prompt.length).toBeLessThanOrEqual(300);
    expect(prompt).toContain("short beat");
    expect(prompt).toContain("kit Runner lock must survive");
  });

  it("exports a clip pack with handoff and durations", () => {
    const pack = toClipPack(source);
    expect(pack.format).toBe("clip-pack");
    expect(pack.beats).toHaveLength(3);
    expect(pack.totalDurationSec).toBe(11);
    expect(pack.beats[0]!.role).toBe("establishing");
    expect(pack.beats[1]!.role).toBe("action");
    expect(pack.beats[2]!.role).toBe("closeup");
    expect(pack.handoff.studioHref).toContain("/studio?tab=video&prompt=");
    expect(pack.handoff.studioHref).toContain("&preset=zoom-out");
    expect(pack.beats.every((b) => b.renderPrompt.length >= b.visualPrompt.length)).toBe(true);
  });

  it("allows look up to 400 chars on storyboard export", () => {
    const look = "y".repeat(400);
    const board = toStoryboard({ ...source, look });
    expect(board.look?.length).toBe(400);
  });

  it("branches on export format", () => {
    expect(exportSequence(source, "storyboard").format).toBe("storyboard");
    expect(exportSequence(source, "clip-pack").format).toBe("clip-pack");
  });
});
