import { afterEach, describe, expect, it, vi } from "vitest";

const { searchVideoMock } = vi.hoisted(() => ({
  searchVideoMock: vi.fn(),
}));

vi.mock("@/lib/ai/stock/provider", () => ({
  selectStockProvider: vi.fn(() => ({
    name: "mock-stock",
    isConfigured: () => Boolean(process.env.TEST_STOCK_CONFIGURED),
    searchVideo: searchVideoMock,
  })),
}));

import { assembledBackend, selectBackend, selfHostedGpuBackend } from "./backend";

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
});
