import { afterEach, describe, expect, it, vi } from "vitest";

const { searchVideoMock, fetchPollinationsVideoMock, pollinationsEnabledMock, putObjectMock } = vi.hoisted(() => ({
  searchVideoMock: vi.fn(),
  fetchPollinationsVideoMock: vi.fn(),
  pollinationsEnabledMock: vi.fn(() => false),
  putObjectMock: vi.fn(async (key: string) => ({ key, url: `https://blob.example/${key}` })),
}));

vi.mock("@/lib/ai/stock/provider", () => ({
  selectStockProvider: vi.fn(() => ({
    name: "mock-stock",
    isConfigured: () => Boolean(process.env.TEST_STOCK_CONFIGURED),
    searchVideo: searchVideoMock,
  })),
}));

vi.mock("@/lib/storage", () => ({
  newStorageKey: (ext: string) => `test-key.${ext}`,
  putObject: putObjectMock,
}));

vi.mock("@/lib/ai/video-provider", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/video-provider")>();
  return {
    ...actual,
    pollinationsAssembledEnabled: pollinationsEnabledMock,
    fetchPollinationsVideo: fetchPollinationsVideoMock,
  };
});

import {
  assembledBackend,
  backendSupportsContinuation,
  NOT_FRAME_CHAINED_LABEL,
  selectBackend,
  STILL_FROM_LAST_FRAME_LABEL,
  selfHostedGpuBackend,
} from "./backend";

describe("selectBackend", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("defaults to the assembled tier", () => {
    expect(selectBackend({})).toBe(assembledBackend);
  });

  it("stays on the assembled tier when the gpu endpoint is not configured", () => {
    expect(selectBackend({ VIDEO_PROVIDER: "gpu" })).toBe(assembledBackend);
  });

  it("selects the gpu stub only when requested and configured", () => {
    vi.stubEnv("VIDEO_GPU_ENDPOINT", "http://localhost:8188");
    expect(selectBackend({ VIDEO_PROVIDER: "gpu" })).toBe(selfHostedGpuBackend);
    expect(selectBackend({})).toBe(assembledBackend);
  });

  it("gpu stub refuses to render", async () => {
    await expect(
      selfHostedGpuBackend.renderShot({ prompt: "x", width: 1, height: 1, seed: 1, mature: false }),
    ).rejects.toThrow("gpu_backend_not_implemented");
  });
});

describe("assembledBackend", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("renders still keyframe when stock provider is not configured", async () => {
    vi.stubEnv("TEST_STOCK_CONFIGURED", "");
    const res = await assembledBackend.renderShot({
      prompt: "neon burger",
      width: 100,
      height: 100,
      seed: 1,
      mature: false,
      stockQuery: "burger grill",
    });

    expect(typeof res).toBe("object");
    if (typeof res === "object") {
      expect(res.mediaType).toBe("image");
      expect(res.imageUrl).toContain("data:image/svg+xml");
    }
    expect(searchVideoMock).not.toHaveBeenCalled();
  });

  it("uses stock video clip when stock provider returns a match", async () => {
    vi.stubEnv("TEST_STOCK_CONFIGURED", "true");
    searchVideoMock.mockResolvedValueOnce({
      id: "stock-1",
      url: "/api/media/file/test.mp4",
      thumbnailUrl: "/api/media/file/test.jpg",
      durationSec: 5,
      width: 1920,
      height: 1080,
    });

    const res = await assembledBackend.renderShot({
      prompt: "neon burger",
      width: 100,
      height: 100,
      seed: 1,
      mature: false,
      stockQuery: "burger grill",
      durationSec: 5,
      aspectRatio: "16:9",
    });

    expect(searchVideoMock).toHaveBeenCalledWith("burger grill", {
      aspectRatio: "16:9",
      durationSec: 5,
    });

    expect(res).toEqual({
      videoUrl: "/api/media/file/test.mp4",
      imageUrl: "/api/media/file/test.jpg",
      mediaType: "video",
      sourceDurationSec: 5,
    });
  });

  it("bypasses stock search for mature requests even if stock query is present", async () => {
    vi.stubEnv("TEST_STOCK_CONFIGURED", "true");
    const res = await assembledBackend.renderShot({
      prompt: "adult content",
      width: 100,
      height: 100,
      seed: 1,
      mature: true,
      stockQuery: "adult content",
    });

    expect(searchVideoMock).not.toHaveBeenCalled();
    if (typeof res === "object") {
      expect(res.mediaType).toBe("image");
    }
  });

  it("broadens the stock query when the specific one misses", async () => {
    vi.stubEnv("TEST_STOCK_CONFIGURED", "true");
    searchVideoMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "s2",
      url: "/api/media/file/b.mp4",
      durationSec: 6,
      width: 1920,
      height: 1080,
    });
    const res = await assembledBackend.renderShot({
      prompt: "x",
      width: 100,
      height: 100,
      seed: 1,
      mature: false,
      stockQuery: "sizzling cheeseburger grill",
    });
    expect(searchVideoMock.mock.calls.map((c) => c[0])).toEqual([
      "sizzling cheeseburger grill",
      "sizzling cheeseburger",
    ]);
    expect(typeof res === "object" && res.mediaType).toBe("video");
  });

  it("falls back to keywords from the shot's own scene text as a last rung", async () => {
    vi.stubEnv("TEST_STOCK_CONFIGURED", "true");
    searchVideoMock.mockResolvedValueOnce(null).mockResolvedValueOnce({
      id: "s3",
      url: "/api/media/file/c.mp4",
      durationSec: 6,
      width: 1920,
      height: 1080,
    });
    const res = await assembledBackend.renderShot({
      prompt: "wide establishing shot, a sizzling cheeseburger on a grill",
      width: 100,
      height: 100,
      seed: 1,
      mature: false,
      stockQuery: "xyzzy",
    });
    expect(searchVideoMock.mock.calls.map((c) => c[0])).toEqual(["xyzzy", "sizzling cheeseburger grill"]);
    expect(typeof res === "object" && res.mediaType).toBe("video");
  });

  it("exposes continuation capability on assembled and gpu backends", () => {
    expect(backendSupportsContinuation(assembledBackend)).toBe(true);
    expect(backendSupportsContinuation(selfHostedGpuBackend)).toBe(true);
    expect(
      backendSupportsContinuation({
        name: "no-continue",
        tier: 1,
        supportsContinuation: false,
        isConfigured: () => true,
        renderShot: vi.fn(),
      }),
    ).toBe(false);
  });

  it("skips stock on continuation and passes init image to Pollinations when supported", async () => {
    vi.stubEnv("TEST_STOCK_CONFIGURED", "true");
    vi.stubEnv("AI_VIDEO_MODEL", "prunaai/p-video");
    pollinationsEnabledMock.mockReturnValue(true);
    fetchPollinationsVideoMock.mockResolvedValueOnce({
      buffer: Buffer.from("mp4-bytes"),
      mimeType: "video/mp4",
    });

    const res = await assembledBackend.renderShot({
      prompt: "Continuing from the previous frame, pan right",
      width: 1280,
      height: 720,
      seed: 1,
      mature: false,
      stockQuery: "burger grill",
      durationSec: 5,
      aspectRatio: "16:9",
      seedImage: "https://blob.example/prev-last-frame.jpg",
      seedImageSource: "client",
      isContinuation: true,
    });

    expect(searchVideoMock).not.toHaveBeenCalled();
    expect(fetchPollinationsVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "prunaai/p-video",
        image: "https://blob.example/prev-last-frame.jpg",
      }),
    );
    expect(res).toMatchObject({
      mediaType: "video",
      videoUrl: "https://blob.example/test-key.mp4",
      frameChained: true,
    });
  });

  it("also forwards server-sourced seedImage to Pollinations", async () => {
    vi.stubEnv("AI_VIDEO_MODEL", "prunaai/p-video");
    pollinationsEnabledMock.mockReturnValue(true);
    fetchPollinationsVideoMock.mockResolvedValueOnce({
      buffer: Buffer.from("mp4-bytes"),
      mimeType: "video/mp4",
    });

    const res = await assembledBackend.renderShot({
      prompt: "Continuing from the previous frame, pan right",
      width: 1280,
      height: 720,
      seed: 1,
      mature: false,
      durationSec: 5,
      seedImage: "https://blob.example/server-last-frame.jpg",
      seedImageSource: "server",
      isContinuation: true,
    });

    expect(fetchPollinationsVideoMock).toHaveBeenCalledWith(
      expect.objectContaining({
        image: "https://blob.example/server-last-frame.jpg",
      }),
    );
    expect(res).toMatchObject({ frameChained: true });
  });

  it("refuses to forward seedImage to Pollinations when seedImageSource is missing", async () => {
    vi.stubEnv("AI_VIDEO_MODEL", "prunaai/p-video");
    pollinationsEnabledMock.mockReturnValue(true);
    fetchPollinationsVideoMock.mockResolvedValueOnce({
      buffer: Buffer.from("mp4-bytes"),
      mimeType: "video/mp4",
    });

    const res = await assembledBackend.renderShot({
      prompt: "Continuing from the previous frame, pan right",
      width: 1280,
      height: 720,
      seed: 1,
      mature: false,
      durationSec: 5,
      seedImage: "https://blob.example/untrusted.jpg",
      isContinuation: true,
    });

    expect(fetchPollinationsVideoMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ image: expect.anything() }),
    );
    expect(res).toMatchObject({
      mediaType: "video",
      frameChained: false,
      continuationFallback: NOT_FRAME_CHAINED_LABEL,
    });
  });

  it("falls back to prompt-only and labels honestly when Pollinations model lacks init-image support", async () => {
    vi.stubEnv("AI_VIDEO_MODEL", "minimax/minimax-h3");
    pollinationsEnabledMock.mockReturnValue(true);
    fetchPollinationsVideoMock.mockResolvedValueOnce({
      buffer: Buffer.from("mp4-bytes"),
      mimeType: "video/mp4",
    });

    const res = await assembledBackend.renderShot({
      prompt: "Continuing from the previous frame, pan right",
      width: 1280,
      height: 720,
      seed: 1,
      mature: false,
      durationSec: 5,
      seedImage: "https://blob.example/prev-last-frame.jpg",
      isContinuation: true,
    });

    expect(fetchPollinationsVideoMock).toHaveBeenCalledWith(
      expect.not.objectContaining({ image: expect.anything() }),
    );
    expect(res).toMatchObject({
      mediaType: "video",
      frameChained: false,
      continuationFallback: NOT_FRAME_CHAINED_LABEL,
    });
  });

  it("never passes a raw data URL or local storage path seedImage to Pollinations", async () => {
    vi.stubEnv("AI_VIDEO_MODEL", "prunaai/p-video");
    pollinationsEnabledMock.mockReturnValue(true);
    fetchPollinationsVideoMock.mockResolvedValue({
      buffer: Buffer.from("mp4-bytes"),
      mimeType: "video/mp4",
    });

    for (const seedImage of [
      "data:image/jpeg;base64,/9j/4AAQ",
      "/api/media/file/local-frame.jpg",
    ]) {
      fetchPollinationsVideoMock.mockClear();
      const res = await assembledBackend.renderShot({
        prompt: "Continuing from the previous frame, pan right",
        width: 1280,
        height: 720,
        seed: 1,
        mature: false,
        durationSec: 5,
        seedImage,
        seedImageSource: "client",
        isContinuation: true,
      });

      expect(fetchPollinationsVideoMock).toHaveBeenCalledWith(
        expect.not.objectContaining({ image: expect.anything() }),
      );
      expect(res).toMatchObject({
        frameChained: false,
        continuationFallback: NOT_FRAME_CHAINED_LABEL,
      });
    }
  });

  it("falls back to a still seeded from lastFrame only when generative video fails", async () => {
    vi.stubEnv("TEST_STOCK_CONFIGURED", "true");
    vi.stubEnv("AI_VIDEO_MODEL", "prunaai/p-video");
    pollinationsEnabledMock.mockReturnValue(true);
    fetchPollinationsVideoMock.mockRejectedValueOnce(new Error("video upstream 500"));
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const res = await assembledBackend.renderShot({
      prompt: "Continuing from the previous frame",
      width: 1280,
      height: 720,
      seed: 1,
      mature: false,
      stockQuery: "burger grill",
      durationSec: 5,
      seedImage: "https://blob.example/prev-last-frame.jpg",
      seedImageSource: "client",
      isContinuation: true,
      seedFromParent: true,
    });

    expect(searchVideoMock).not.toHaveBeenCalled();
    expect(res).toEqual({
      imageUrl: "https://blob.example/prev-last-frame.jpg",
      mediaType: "image",
      lastFrame: "https://blob.example/prev-last-frame.jpg",
      lastFrameSource: "client",
      frameChained: true,
      continuationFallback: STILL_FROM_LAST_FRAME_LABEL,
    });
  });

  it("labels prompt-only keyframe continuations as not frame-chained", async () => {
    pollinationsEnabledMock.mockReturnValue(false);
    const res = await assembledBackend.renderShot({
      prompt: "Continuing from the previous frame",
      width: 1280,
      height: 720,
      seed: 1,
      mature: false,
      durationSec: 5,
      isContinuation: true,
    });

    expect(res).toMatchObject({
      mediaType: "image",
      frameChained: false,
      continuationFallback: NOT_FRAME_CHAINED_LABEL,
    });
  });

  it("renders its own keyframe for in-job shots that merely carry a seed image", async () => {
    pollinationsEnabledMock.mockReturnValue(false);
    const res = await assembledBackend.renderShot({
      prompt: "close-up of melting cheese",
      width: 100,
      height: 100,
      seed: 2,
      mature: false,
      durationSec: 4,
      seedImage: "https://blob.example/prev-shot.jpg",
      seedImageSource: "server",
    });

    expect(typeof res).toBe("object");
    if (typeof res === "object") {
      expect(res.mediaType).toBe("image");
      expect(res.imageUrl).toContain("data:image/svg+xml");
      expect(res.imageUrl).not.toBe("https://blob.example/prev-shot.jpg");
      expect(res.frameChained).toBeUndefined();
      expect(res.continuationFallback).toBeUndefined();
    }
  });

  it("still searches stock for in-job shots that merely carry a seed image", async () => {
    vi.stubEnv("TEST_STOCK_CONFIGURED", "true");
    searchVideoMock.mockResolvedValueOnce({
      id: "stock-2",
      url: "/api/media/file/test2.mp4",
      thumbnailUrl: "/api/media/file/test2.jpg",
      durationSec: 5,
      width: 1920,
      height: 1080,
    });
    const res = await assembledBackend.renderShot({
      prompt: "melting cheese",
      width: 100,
      height: 100,
      seed: 2,
      mature: false,
      stockQuery: "melting cheese",
      durationSec: 5,
      aspectRatio: "16:9",
      seedImage: "https://blob.example/prev-shot.jpg",
      seedImageSource: "server",
    });

    expect(searchVideoMock).toHaveBeenCalled();
    expect(res).toMatchObject({ mediaType: "video", videoUrl: "/api/media/file/test2.mp4" });
  });

  it("does not reuse the seed as a still unless it is the parent clip's last frame", async () => {
    pollinationsEnabledMock.mockReturnValue(false);
    const res = await assembledBackend.renderShot({
      prompt: "second shot of a continuation",
      width: 100,
      height: 100,
      seed: 3,
      mature: false,
      durationSec: 4,
      seedImage: "https://blob.example/prev-shot.jpg",
      seedImageSource: "server",
      isContinuation: true,
    });

    expect(res).toMatchObject({
      mediaType: "image",
      frameChained: false,
      continuationFallback: NOT_FRAME_CHAINED_LABEL,
    });
    if (typeof res === "object") expect(res.imageUrl).not.toBe("https://blob.example/prev-shot.jpg");
  });
});
