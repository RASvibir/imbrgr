import { describe, expect, it } from "vitest";
import { composeGpuPrompt, composeShotText, shotScaleFor } from "./compose";

describe("composeGpuPrompt", () => {
  it("puts subject, camera move, then style", () => {
    const out = composeGpuPrompt({ visualPrompt: "a burger on a grill.", motion: "orbit" });
    expect(out.startsWith("a burger on a grill, gentle orbital camera drift around the subject")).toBe(true);
    expect(out).toContain("smooth continuous motion");
  });

  it("does not stack a second camera move when the scene already names one", () => {
    const out = composeGpuPrompt({
      visualPrompt: "a burger on a grill, gentle orbital camera drift around the subject",
      motion: "zoom-in",
    });
    expect(out).toMatch(/orbital camera drift/i);
    expect(out).not.toMatch(/push-in/i);
  });

  it("writes continuation clips as what changes next", () => {
    const out = composeGpuPrompt({ visualPrompt: "flames rise", motion: "zoom-in", continuation: true });
    expect(out).toMatch(/^Continuing from the previous frame, same subject and setting, now flames rise/);
    expect(out).toContain("push-in");
  });

  it("does not restack camera language on continuation when the scene already has the move", () => {
    const scene =
      "flames rise, slow cinematic push-in toward the focal point, steady framing";
    const out = composeGpuPrompt({ visualPrompt: scene, motion: "zoom-in", continuation: true });
    expect(out.match(/push-in/gi)?.length ?? 0).toBe(1);
  });

  it("does not restack camera on action-only continuation when action already names the move", () => {
    const out = composeGpuPrompt({
      visualPrompt: "ignored",
      action: "steam rises, gentle orbital camera drift around the subject, level horizon",
      motion: "orbit",
      continuation: true,
    });
    expect(out.match(/orbital camera drift/gi)?.length ?? 0).toBe(1);
    expect(out).not.toContain("push-in");
  });
});

describe("shot scale ladder", () => {
  it("goes wide to close-up and skips single shots", () => {
    expect([0, 1, 2].map((i) => shotScaleFor(i, 3))).toEqual(["wide establishing shot", "medium shot", "close-up"]);
    expect(shotScaleFor(0, 1)).toBeUndefined();
    expect(shotScaleFor(3, 4)).toBe("close-up");
  });
});

describe("composeShotText", () => {
  it("orders framing, look, scene and respects a framing the scene already names", () => {
    expect(composeShotText({ visualPrompt: "a burger.", look: "neon bar", scale: "close-up" })).toBe("close-up, neon bar, a burger");
    expect(composeShotText({ visualPrompt: "a wide view of a burger", scale: "close-up" })).toBe("a wide view of a burger");
  });
});

describe("composeGpuPrompt with anchors", () => {
  it("chained clip with an action drops scene text and style", () => {
    const out = composeGpuPrompt({ visualPrompt: "long scene text", look: "neon bar", action: "flames rise", motion: "zoom-in", continuation: true, style: "cyberpunk" });
    expect(out).toBe(
      "Continuing from the previous frame: flames rise, slow cinematic push-in toward the focal point, steady framing",
    );
  });

  it("first clip combines framing, look, scene, action, camera and style", () => {
    const out = composeGpuPrompt({ visualPrompt: "a burger", look: "neon bar", scale: "wide establishing shot", action: "steam rises", motion: "orbit" });
    expect(
      out.startsWith(
        "wide establishing shot, neon bar, a burger, steam rises, gentle orbital camera drift around the subject",
      ),
    ).toBe(true);
  });

  it("uses characterMotion as action when the scene has no subject motion", () => {
    const out = composeGpuPrompt({
      visualPrompt: "hero in a raincoat",
      motion: "zoom-in",
      characterMotion: "walk",
    });
    expect(out).toMatch(/walks forward with a natural looping gait/i);
    expect(out.match(/natural looping gait/gi)?.length ?? 0).toBe(1);
  });

  it("still applies characterMotion when the scene has unrelated motion words", () => {
    const out = composeGpuPrompt({
      visualPrompt: "hero in a raincoat, steam rising, rain streaking past",
      motion: "zoom-in",
      characterMotion: "walk",
    });
    expect(out).toMatch(/walks forward with a natural looping gait/i);
  });

  it("does not duplicate characterMotion when enhance already injected the phrase", () => {
    const enhanced =
      "hero in a raincoat, subject walks forward with a natural looping gait, steady pace, arms swinging lightly";
    const out = composeGpuPrompt({
      visualPrompt: enhanced,
      motion: "zoom-in",
      characterMotion: "walk",
    });
    expect(out.match(/natural looping gait/gi)?.length ?? 0).toBe(1);
  });

  it("uses characterMotion on continuation without restating the scene", () => {
    const out = composeGpuPrompt({
      visualPrompt: "long scene text with steam rising",
      motion: "orbit",
      characterMotion: "emote",
      continuation: true,
    });
    expect(out).toMatch(/^Continuing from the previous frame: subject performs a clear expressive gesture/);
    expect(out).not.toContain("long scene text");
  });
});
