import { beforeEach, describe, expect, it, vi } from "vitest";

const { mediaFindFirst, userFindFirst, userFindUnique, queryRaw, statObjectMock } = vi.hoisted(() => ({
  mediaFindFirst: vi.fn(),
  userFindFirst: vi.fn(),
  userFindUnique: vi.fn(),
  queryRaw: vi.fn(),
  statObjectMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    media: { findFirst: mediaFindFirst },
    user: { findFirst: userFindFirst, findUnique: userFindUnique },
    $queryRaw: queryRaw,
  },
}));

vi.mock("@/lib/storage", () => ({
  statObject: statObjectMock,
  storageDriver: () => "local",
}));

import { clearVideoJobFileCache, serveMediaFile } from "./serve-media-file";

const actor = { userId: "user-1", voterKey: "u:user-1", ipHash: "ip-1" };

function mockStoredBytes(text: string) {
  const bytes = new TextEncoder().encode(text);
  statObjectMock.mockResolvedValue({
    size: bytes.byteLength,
    async open() {
      return new ReadableStream({
        start(controller) {
          controller.enqueue(bytes);
          controller.close();
        },
      });
    },
  });
}

describe("serveMediaFile VideoJob ownership lookup", () => {
  beforeEach(() => {
    clearVideoJobFileCache();
    mediaFindFirst.mockReset().mockResolvedValue(null);
    userFindFirst.mockReset().mockResolvedValue(null);
    userFindUnique.mockReset().mockResolvedValue(null);
    queryRaw.mockReset().mockResolvedValue([]);
    statObjectMock.mockReset();
  });

  it("finds a matching VideoJob shot key via $queryRaw and caches repeat lookups", async () => {
    queryRaw.mockResolvedValueOnce([
      {
        shots: [
          {
            videoUrl: "/api/media/file/clip-123.mp4?mime=video%2Fmp4",
          },
        ],
      },
    ]);
    mockStoredBytes("mp4");

    const req = new Request("http://localhost:3000/api/media/file/clip-123.mp4");
    const first = await serveMediaFile(req, "clip-123.mp4", actor);
    expect(first.status).toBe(200);
    expect(queryRaw).toHaveBeenCalledTimes(1);

    // Repeat request (e.g. byte-range scrub) hits the short-TTL cache without re-querying DB.
    const second = await serveMediaFile(req, "clip-123.mp4", actor);
    expect(second.status).toBe(200);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it("returns 404 when $queryRaw finds no matching job or only a partial key prefix", async () => {
    queryRaw.mockResolvedValueOnce([]);
    const missing = await serveMediaFile(
      new Request("http://localhost:3000/api/media/file/missing.jpg"),
      "missing.jpg",
      actor,
    );
    expect(missing.status).toBe(404);
    expect(statObjectMock).not.toHaveBeenCalled();

    // A LIKE match on "frame.jpg" inside "frame.jpg2" must still be rejected by exact path comparison.
    queryRaw.mockResolvedValueOnce([
      {
        shots: [{ lastFrame: "/api/media/file/frame.jpg2" }],
      },
    ]);
    const prefixOnly = await serveMediaFile(
      new Request("http://localhost:3000/api/media/file/frame.jpg"),
      "frame.jpg",
      actor,
    );
    expect(prefixOnly.status).toBe(404);
    expect(statObjectMock).not.toHaveBeenCalled();
  });

  it("skips VideoJob lookup when a Media row exists", async () => {
    mediaFindFirst.mockResolvedValueOnce({ visibility: "PUBLIC", post: null });
    mockStoredBytes("img");

    const res = await serveMediaFile(
      new Request("http://localhost:3000/api/media/file/photo.jpg"),
      "photo.jpg",
      actor,
    );
    expect(res.status).toBe(200);
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("blocks mature media with 403 unless the viewer is signed in and 18+ verified", async () => {
    mediaFindFirst.mockResolvedValueOnce({ visibility: "UNLISTED", mature: true, post: null });
    const guestRes = await serveMediaFile(
      new Request("http://localhost:3000/api/media/file/adult.jpg"),
      "adult.jpg",
      { userId: null, voterKey: "anon:1", ipHash: "ip-1" },
    );
    expect(guestRes.status).toBe(403);
    expect(statObjectMock).not.toHaveBeenCalled();

    mediaFindFirst.mockResolvedValueOnce({ visibility: "UNLISTED", mature: true, post: null });
    userFindUnique.mockResolvedValueOnce({ birthDate: new Date("2015-01-01T00:00:00Z"), adultVerifiedAt: new Date() });
    const minorRes = await serveMediaFile(
      new Request("http://localhost:3000/api/media/file/adult.jpg"),
      "adult.jpg",
      actor,
    );
    expect(minorRes.status).toBe(403);

    mediaFindFirst.mockResolvedValueOnce({ visibility: "UNLISTED", mature: true, post: null });
    userFindUnique.mockResolvedValueOnce({
      birthDate: new Date("1990-01-01T00:00:00Z"),
      adultVerifiedAt: new Date("2026-01-01T00:00:00Z"),
    });
    mockStoredBytes("adult-img");
    const adultRes = await serveMediaFile(
      new Request("http://localhost:3000/api/media/file/adult.jpg"),
      "adult.jpg",
      actor,
    );
    expect(adultRes.status).toBe(200);
    expect(adultRes.headers.get("cache-control")).toBe("private, no-store");
  });
});
