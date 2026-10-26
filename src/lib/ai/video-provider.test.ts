import { afterEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { generateAiVideo } from "@/lib/ai/video-generate";
import {
  buildCinematicVideoPrompt,
  resolveVideoDimensions,
  CAMERA_MOTIONS,
  VIDEO_STYLES,
} from "@/lib/ai/video-provider";

const generateMock = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/image-provider", () => ({
  defaultImageProvider: { name: "pollinations", generate: generateMock },
}));

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
      mode: "gif",
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

describe("AI Video Provider (live mode)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    generateMock.mockReset();
  });

  function useLiveMode() {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("AI_MOCK", "false");
  }

  it("throws when the image provider fails instead of returning a dead URL", async () => {
    useLiveMode();
    generateMock.mockRejectedValueOnce(new Error("image_gen_http_402"));
    await expect(generateAiVideo({ prompt: "neon burger" })).rejects.toThrow("image_gen_http_402");
  });

  it("returns a JPEG data URL from the provider image", async () => {
    useLiveMode();
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 200, g: 80, b: 20 } },
    })
      .png()
      .toBuffer();
    generateMock.mockResolvedValueOnce({ buffer: png, mimeType: "image/png", provider: "pollinations", seed: 1 });
    const res = await generateAiVideo({ prompt: "neon burger", aspectRatio: "9:16" });
    expect(res.previewUrl.startsWith("data:image/jpeg;base64,")).toBe(true);
    expect(generateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        width: 720,
        height: 1280,
        safe: true,
        maxAttempts: 2,
        timeoutMs: 22_000,
      }),
    );
  });

  it("skips the provider when a source image is supplied", async () => {
    useLiveMode();
    const res = await generateAiVideo({ prompt: "neon burger", sourceImageUrl: "https://example.com/a.png" });
    expect(res.previewUrl).toBe("https://example.com/a.png");
    expect(generateMock).not.toHaveBeenCalled();
  });
});
