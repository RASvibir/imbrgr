import { describe, expect, it } from "vitest";
import { exportSequence, toClipPack, toStoryboard } from "./export";
import { defaultBeats, defaultLook } from "./defaults";

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
    expect(pack.beats.every((b) => b.renderPrompt.length >= b.visualPrompt.length)).toBe(true);
  });

  it("branches on export format", () => {
    expect(exportSequence(source, "storyboard").format).toBe("storyboard");
    expect(exportSequence(source, "clip-pack").format).toBe("clip-pack");
  });
});
