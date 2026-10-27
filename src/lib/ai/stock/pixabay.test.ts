import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { putObjectMock } = vi.hoisted(() => ({
  putObjectMock: vi.fn(),
}));

vi.mock("@/lib/storage", () => ({
  newStorageKey: (ext: string) => `test-key-${ext}.${ext}`,
  putObject: putObjectMock,
}));

import { clearPixabayCache, pixabayProvider } from "./pixabay";

function mockFetchResponses(responses: { status?: number; json?: () => Promise<unknown>; arrayBuffer?: () => Promise<ArrayBuffer> }[]) {
  let callCount = 0;
  const fn = vi.fn(async () => {
    const r = responses[callCount] ?? responses[responses.length - 1];
    callCount++;
    return {
      ok: (r.status ?? 200) >= 200 && (r.status ?? 200) < 300,
      status: r.status ?? 200,
      json: r.json ?? (async () => ({})),
      arrayBuffer: r.arrayBuffer ?? (async () => new Uint8Array([1, 2, 3]).buffer),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("pixabayProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearPixabayCache();
    putObjectMock.mockImplementation(async (key: string) => ({
      key,
      url: `/api/media/file/${key}`,
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is configured only when PIXABAY_API_KEY is set", () => {
    vi.stubEnv("PIXABAY_API_KEY", "");
    expect(pixabayProvider.isConfigured()).toBe(false);

    vi.stubEnv("PIXABAY_API_KEY", "test-key");
    expect(pixabayProvider.isConfigured()).toBe(true);
  });

  it("returns null if PIXABAY_API_KEY is missing", async () => {
    vi.stubEnv("PIXABAY_API_KEY", "");
    const res = await pixabayProvider.searchVideo("burger");
    expect(res).toBeNull();
  });

  it("searches Pixabay, downloads the clip and stores it in object storage", async () => {
    vi.stubEnv("PIXABAY_API_KEY", "secret-key");

    const sampleHit = {
      id: 12345,
      duration: 6,
      videos: {
        small: {
          url: "https://cdn.pixabay.com/video/small.mp4",
          width: 1920,
          height: 1080,
          size: 2048,
          thumbnail: "https://cdn.pixabay.com/video/thumb.jpg",
        },
      },
    };

    const fetchMock = mockFetchResponses([
      // 1. Pixabay API response
      {
        status: 200,
        json: async () => ({
          total: 1,
          totalHits: 1,
          hits: [sampleHit],
        }),
      },
      // 2. Video download response
      {
        status: 200,
        arrayBuffer: async () => new Uint8Array([0, 1, 2, 3]).buffer,
      },
      // 3. Thumbnail download response
      {
        status: 200,
        arrayBuffer: async () => new Uint8Array([4, 5, 6]).buffer,
      },
    ]);

    const result = await pixabayProvider.searchVideo("fresh burger", { aspectRatio: "16:9" });

    expect(result).not.toBeNull();
    expect(result?.id).toBe("pixabay-12345");
    expect(result?.durationSec).toBe(6);
    expect(result?.url).toBe("/api/media/file/test-key-mp4.mp4");
    expect(result?.thumbnailUrl).toBe("/api/media/file/test-key-jpg.jpg");

    expect(putObjectMock).toHaveBeenCalledTimes(2);
    expect(putObjectMock).toHaveBeenCalledWith("test-key-mp4.mp4", expect.any(Buffer), "video/mp4");
    expect(putObjectMock).toHaveBeenCalledWith("test-key-jpg.jpg", expect.any(Buffer), "image/jpeg");

    // Pixabay search request URL verification
    const calls = fetchMock.mock.calls as unknown as [string, ...unknown[]][];
    const firstCallUrl = calls[0]?.[0] ?? "";
    expect(firstCallUrl).toContain("https://pixabay.com/api/videos/");
    expect(firstCallUrl).toContain("q=fresh+burger");
    expect(firstCallUrl).toContain("safesearch=true");
  });

  it("prefers a clip at least as long as the shot and carries the attribution page", async () => {
    vi.stubEnv("PIXABAY_API_KEY", "secret-key");
    const size = (name: string) => ({ url: `https://cdn.pixabay.com/${name}.mp4`, width: 1280, height: 720, size: 1 });
    mockFetchResponses([
      {
        status: 200,
        json: async () => ({
          total: 3,
          totalHits: 3,
          hits: [
            { id: 1, duration: 4, pageURL: "https://pixabay.com/videos/a-1/", videos: { small: size("short") } },
            { id: 2, duration: 12, pageURL: "https://pixabay.com/videos/b-2/", videos: { small: size("long") } },
            { id: 3, duration: 9, pageURL: "https://pixabay.com/videos/c-3/", videos: { small: size("mid") } },
          ],
        }),
      },
      { status: 200 },
    ]);
    const clip = await pixabayProvider.searchVideo("beach waves", { aspectRatio: "16:9", durationSec: 8 });
    expect(clip?.id).toBe("pixabay-2");
    expect(clip?.pageUrl).toBe("https://pixabay.com/videos/b-2/");
  });

  it("falls back to the longest clip when none is long enough", async () => {
    vi.stubEnv("PIXABAY_API_KEY", "secret-key");
    const size = (name: string) => ({ url: `https://cdn.pixabay.com/${name}.mp4`, width: 1280, height: 720, size: 1 });
    mockFetchResponses([
      {
        status: 200,
        json: async () => ({
          total: 2,
          totalHits: 2,
          hits: [
            { id: 1, duration: 3, videos: { small: size("a") } },
            { id: 2, duration: 6, videos: { small: size("b") } },
          ],
        }),
      },
      { status: 200 },
    ]);
    const clip = await pixabayProvider.searchVideo("city night", { durationSec: 13 });
    expect(clip?.id).toBe("pixabay-2");
    expect(clip?.durationSec).toBe(6);
  });

  it("caches successful queries for 24 hours without duplicate network calls", async () => {
    vi.stubEnv("PIXABAY_API_KEY", "secret-key");

    const fetchMock = mockFetchResponses([
      {
        status: 200,
        json: async () => ({
          total: 1,
          totalHits: 1,
          hits: [
            {
              id: 999,
              duration: 4,
              videos: {
                tiny: { url: "https://cdn.pixabay.com/video/tiny.mp4", width: 640, height: 360, size: 1024 },
              },
            },
          ],
        }),
      },
      {
        status: 200,
        arrayBuffer: async () => new Uint8Array([10, 20]).buffer,
      },
    ]);

    const first = await pixabayProvider.searchVideo("sunset ocean");
    expect(first?.id).toBe("pixabay-999");
    const callsAfterFirst = fetchMock.mock.calls.length;

    // Second call with same query should hit cache
    const second = await pixabayProvider.searchVideo("sunset ocean");
    expect(second?.id).toBe("pixabay-999");
    expect(fetchMock.mock.calls.length).toBe(callsAfterFirst);
  });

  it("handles 429 rate limit gracefully by returning null without throwing", async () => {
    vi.stubEnv("PIXABAY_API_KEY", "secret-key");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    mockFetchResponses([
      {
        status: 429,
        json: async () => ({ message: "rate limit" }),
      },
    ]);

    const result = await pixabayProvider.searchVideo("busy street");
    expect(result).toBeNull();
    expect(warnSpy).toHaveBeenCalled();
  });

  it("selects video matching vertical aspect ratio (9:16) when available", async () => {
    vi.stubEnv("PIXABAY_API_KEY", "secret-key");

    const landscapeHit = {
      id: 1,
      duration: 5,
      videos: {
        small: { url: "https://cdn.pixabay.com/video/land.mp4", width: 1920, height: 1080, size: 2000 },
      },
    };
    const portraitHit = {
      id: 2,
      duration: 5,
      videos: {
        small: { url: "https://cdn.pixabay.com/video/port.mp4", width: 1080, height: 1920, size: 2000 },
      },
    };

    mockFetchResponses([
      {
        status: 200,
        json: async () => ({
          total: 2,
          totalHits: 2,
          hits: [landscapeHit, portraitHit],
        }),
      },
      {
        status: 200,
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      },
    ]);

    const result = await pixabayProvider.searchVideo("vertical scene", { aspectRatio: "9:16" });
    expect(result?.id).toBe("pixabay-2");
    expect(result?.width).toBe(1080);
    expect(result?.height).toBe(1920);
  });
});
