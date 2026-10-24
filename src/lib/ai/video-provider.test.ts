import { describe, expect, it } from "vitest";
import {
  generateAiVideo,
  buildCinematicVideoPrompt,
  resolveVideoDimensions,
  CAMERA_MOTIONS,
  VIDEO_STYLES,
} from "@/lib/ai/video-provider";

describe("AI Video Provider", () => {
  it("resolves correct dimensions for aspect ratios", () => {
    expect(resolveVideoDimensions("16:9")).toEqual({ width: 1280, height: 720 });
    expect(resolveVideoDimensions("9:16")).toEqual({ width: 720, height: 1280 });
    expect(resolveVideoDimensions("1:1")).toEqual({ width: 1080, height: 1080 });
  });

  it("appends cinematic style modifiers properly", () => {
    const prompt = buildCinematicVideoPrompt("flame-grilled burger", "cyberpunk");
    expect(prompt).toContain("flame-grilled burger");
    expect(prompt).toContain("neon glow");
  });

  it("exposes known camera motions and video styles", () => {
    expect(CAMERA_MOTIONS.length).toBeGreaterThanOrEqual(5);
    expect(VIDEO_STYLES.length).toBeGreaterThanOrEqual(5);
    expect(CAMERA_MOTIONS.map((m) => m.id)).toContain("zoom-in");
    expect(CAMERA_MOTIONS.map((m) => m.id)).toContain("pan-right");
  });

  it("generates synthetic video result in test mode", async () => {
    const res = await generateAiVideo({
      prompt: "tasty cheeseburger sizzling",
      motion: "pan-right",
      durationSec: 4,
      aspectRatio: "16:9",
    });

    expect(res).toBeDefined();
    expect(res.durationSec).toBe(4);
    expect(res.motion).toBe("pan-right");
    expect(res.width).toBe(1280);
    expect(res.height).toBe(720);
    expect(res.previewUrl).toBeTruthy();
  });
});
