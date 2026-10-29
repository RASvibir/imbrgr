import { describe, expect, it } from "vitest";
import { composeGpuPrompt, composeShotText, shotScaleFor } from "./compose";

describe("composeGpuPrompt", () => {
  it("puts subject, camera move, then style", () => {
    const out = composeGpuPrompt({ visualPrompt: "a burger on a grill.", motion: "orbit" });
    expect(out.startsWith("a burger on a grill, camera orbiting around the subject")).toBe(true);
    expect(out).toContain("smooth cinematic motion");
  });

  it("writes continuation clips as what changes next", () => {
    const out = composeGpuPrompt({ visualPrompt: "flames rise", motion: "zoom-in", continuation: true });
    expect(out).toMatch(/^Continuing from the previous frame, same subject and setting, now flames rise/);
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
    expect(out).toBe("Continuing from the previous frame: flames rise, slow push-in toward the subject");
  });

  it("first clip combines framing, look, scene, action, camera and style", () => {
    const out = composeGpuPrompt({ visualPrompt: "a burger", look: "neon bar", scale: "wide establishing shot", action: "steam rises", motion: "orbit" });
    expect(out.startsWith("wide establishing shot, neon bar, a burger, steam rises, camera orbiting around the subject")).toBe(true);
  });
});
