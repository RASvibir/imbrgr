import { describe, expect, it } from "vitest";
import { PLATE_PRESETS, resolvePlatePreset, resolveStudioVideoPreset } from "./plate-presets";

describe("plate presets", () => {
  it("ships character + camera-loop presets", () => {
    const ids = PLATE_PRESETS.map((p) => p.id);
    expect(ids).toEqual(
      expect.arrayContaining(["idle", "walk", "emote", "pan-loop", "zoom-loop", "orbit-loop"]),
    );
  });

  it("resolves camera-loop deep links with motionLoop", () => {
    const pan = resolveStudioVideoPreset("pan-loop");
    expect(pan.cameraMotion).toBe("pan-right");
    expect(pan.motionLoop).toBe(true);
    expect(pan.characterMotion).toBeUndefined();

    const zoom = resolveStudioVideoPreset("zoom-loop");
    expect(zoom.cameraMotion).toBe("zoom-in");
    expect(zoom.motionLoop).toBe(true);
  });

  it("resolves character presets with subject motion + looping pulse", () => {
    const idle = resolveStudioVideoPreset("idle");
    expect(idle.characterMotion).toBe("idle");
    expect(idle.cameraMotion).toBe("pulse");
    expect(idle.motionLoop).toBe(true);
  });

  it("still resolves raw camera motion deep links", () => {
    const zoom = resolveStudioVideoPreset("zoom-in");
    expect(zoom.cameraMotion).toBe("zoom-in");
    expect(zoom.plate).toBeUndefined();
  });

  it("keeps copy free of game marketing terms", () => {
    const blob = PLATE_PRESETS.map((p) => `${p.label} ${p.description}`).join(" ");
    expect(blob).not.toMatch(/heyumps|cutscene|game|sprite/i);
    expect(resolvePlatePreset("walk")?.label).toBe("Walk Cycle");
  });
});
