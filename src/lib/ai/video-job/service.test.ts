import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, updateMany, create, recordUser, recordAnon } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
  recordUser: vi.fn(),
  recordAnon: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { videoJob: { findUnique, updateMany, create } } }));
vi.mock("@/lib/ai/usage", () => ({
  recordAiGenerationSuccess: recordUser,
  recordAnonymousAiSuccess: recordAnon,
}));

import { ownerKeyFor, serializeJob, stepVideoJob } from "./service";
import type { ShotBackend } from "./backend";

const input = {
  prompt: "p",
  aspectRatio: "16:9",
  mode: "video",
  durationSec: 8,
  motion: "zoom-in",
  seed: 10,
  mature: false,
};

function row(over: Record<string, unknown> = {}) {
  return {
    id: "j1",
    ownerKey: "u:user1",
    userId: "user1",
    ipHash: null,
    status: "queued",
    input,
    shots: [
      { durationSec: 4, visualPrompt: "a", motion: "zoom-in" },
      { durationSec: 4, visualPrompt: "b", motion: "pan-left" },
    ],
    nextShot: 0,
    error: null,
    ...over,
  };
}

const actor = { userId: "user1", ipHash: "h" };
const okBackend: ShotBackend = {
  name: "t",
  tier: 1,
  isConfigured: () => true,
  renderShot: vi.fn().mockResolvedValue("data:image/jpeg;base64,AA"),
};

describe("stepVideoJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (okBackend.renderShot as ReturnType<typeof vi.fn>).mockResolvedValue("data:image/jpeg;base64,AA");
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("returns null for a job owned by someone else", async () => {
    findUnique.mockResolvedValueOnce(row({ ownerKey: "u:other" }));
    expect(await stepVideoJob("j1", actor, okBackend)).toBeNull();
    expect(okBackend.renderShot).not.toHaveBeenCalled();
  });

  it("renders the next shot without recording quota until the last one", async () => {
    findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ nextShot: 1, status: "running" }));
    const res = await stepVideoJob("j1", actor, okBackend);
    expect(res?.nextShot).toBe(1);
    expect(okBackend.renderShot).toHaveBeenCalledWith(expect.objectContaining({ prompt: "a", seed: 10, mature: false }));
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ nextShot: 1, status: "running" }) }),
    );
    expect(recordUser).not.toHaveBeenCalled();
  });

  it("records quota once when the last shot completes", async () => {
    findUnique.mockResolvedValueOnce(row({ nextShot: 1, status: "running" })).mockResolvedValueOnce(row({ status: "done", nextShot: 2 }));
    await stepVideoJob("j1", actor, okBackend);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "done" }) }));
    expect(recordUser).toHaveBeenCalledTimes(1);
    expect(recordUser).toHaveBeenCalledWith("user1", 1);
  });

  it("does not record quota when another step already claimed the shot", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    findUnique.mockResolvedValueOnce(row({ nextShot: 1, status: "running" })).mockResolvedValueOnce(row({ status: "done", nextShot: 2 }));
    await stepVideoJob("j1", actor, okBackend);
    expect(recordUser).not.toHaveBeenCalled();
  });

  it("records anonymous quota for guest jobs", async () => {
    const guest = { userId: null, ipHash: "h" };
    findUnique
      .mockResolvedValueOnce(row({ ownerKey: "ip:h", userId: null, ipHash: "h", nextShot: 1, status: "running" }))
      .mockResolvedValueOnce(row({ status: "done" }));
    await stepVideoJob("j1", guest, okBackend);
    expect(recordAnon).toHaveBeenCalledWith("h", 1);
    expect(recordUser).not.toHaveBeenCalled();
  });

  it("fails the job without recording quota when rendering throws", async () => {
    (okBackend.renderShot as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("image_gen_http_402"));
    findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ status: "failed" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await stepVideoJob("j1", actor, okBackend);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }));
    expect(recordUser).not.toHaveBeenCalled();
  });

  it("leaves finished jobs alone", async () => {
    findUnique.mockResolvedValueOnce(row({ status: "done", nextShot: 2 }));
    const res = await stepVideoJob("j1", actor, okBackend);
    expect(res?.status).toBe("done");
    expect(okBackend.renderShot).not.toHaveBeenCalled();
  });

  it("renders stock video results with videoUrl and mediaType", async () => {
    const videoBackend: ShotBackend = {
      name: "stock-test",
      tier: 1,
      isConfigured: () => true,
      renderShot: vi.fn().mockResolvedValue({
        videoUrl: "/api/media/file/clip.mp4",
        imageUrl: "/api/media/file/poster.jpg",
        mediaType: "video",
      }),
    };
    findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ nextShot: 1, status: "running" }));
    await stepVideoJob("j1", actor, videoBackend);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          shots: [
            expect.objectContaining({
              videoUrl: "/api/media/file/clip.mp4",
              imageUrl: "/api/media/file/poster.jpg",
              mediaType: "video",
            }),
            expect.objectContaining({ visualPrompt: "b" }),
          ],
        }),
      }),
    );
  });
});

describe("stepVideoJob with an async backend", () => {
  const gpu = (advance: ReturnType<typeof vi.fn>): ShotBackend => ({
    name: "gpu",
    tier: 3,
    isConfigured: () => true,
    renderShot: vi.fn(),
    advanceShot: advance,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("stores the remote id and keeps the shot open while the GPU works", async () => {
    const advance = vi.fn().mockResolvedValue({ state: "pending", remoteId: "r1" });
    findUnique.mockResolvedValueOnce(row()).mockResolvedValueOnce(row({ status: "running" }));
    await stepVideoJob("j1", actor, gpu(advance));
    const data = updateMany.mock.calls[0][0].data;
    expect(data.status).toBe("running");
    expect(data.nextShot).toBeUndefined();
    expect(data.shots[0].remoteId).toBe("r1");
    expect(typeof data.shots[0].startedAt).toBe("number");
    expect(recordUser).not.toHaveBeenCalled();
  });

  it("passes the previous clip's last frame into the next clip", async () => {
    const advance = vi.fn().mockResolvedValue({ state: "pending", remoteId: "r2" });
    const shots = [
      { durationSec: 4, visualPrompt: "a", motion: "zoom-in", videoUrl: "/v1.mp4", lastFrame: "data:image/jpeg;base64,AA" },
      { durationSec: 4, visualPrompt: "b", motion: "zoom-in" },
    ];
    findUnique.mockResolvedValueOnce(row({ shots, nextShot: 1, status: "running" })).mockResolvedValueOnce(row());
    await stepVideoJob("j1", actor, gpu(advance));
    expect(advance).toHaveBeenCalledWith(expect.objectContaining({ initImage: "data:image/jpeg;base64,AA" }));
  });

  it("advances and records quota when the last clip finishes", async () => {
    const advance = vi.fn().mockResolvedValue({
      state: "done",
      result: { videoUrl: "/v2.mp4", mediaType: "video" },
      lastFrame: "data:image/jpeg;base64,BB",
    });
    const shots = [
      { durationSec: 4, visualPrompt: "a", motion: "zoom-in", videoUrl: "/v1.mp4" },
      { durationSec: 4, visualPrompt: "b", motion: "zoom-in", remoteId: "r2", startedAt: Date.now() },
    ];
    findUnique.mockResolvedValueOnce(row({ shots, nextShot: 1, status: "running" })).mockResolvedValueOnce(row({ status: "done" }));
    await stepVideoJob("j1", actor, gpu(advance));
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "done", nextShot: 2 }) }));
    expect(recordUser).toHaveBeenCalledTimes(1);
  });

  it("fails the job when the GPU run exceeds the timeout", async () => {
    const advance = vi.fn();
    const shots = [{ durationSec: 4, visualPrompt: "a", motion: "zoom-in", remoteId: "r1", startedAt: Date.now() - 2_000_000 }];
    findUnique.mockResolvedValueOnce(row({ shots, status: "running" })).mockResolvedValueOnce(row({ status: "failed" }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await stepVideoJob("j1", actor, gpu(advance));
    expect(advance).not.toHaveBeenCalled();
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "failed" }) }));
    expect(recordUser).not.toHaveBeenCalled();
  });
});

describe("serializeJob", () => {
  it("includes images only for finished jobs when requested", () => {
    expect(serializeJob(row() as never, { images: true }).shots).toBeUndefined();
    expect(serializeJob(row({ status: "done", nextShot: 2 }) as never, { images: true }).shots).toHaveLength(2);
    const withInternals = row({
      status: "done",
      nextShot: 1,
      shots: [{ durationSec: 4, visualPrompt: "a", motion: "zoom-in", remoteId: "r", startedAt: 1, lastFrame: "x" }],
    });
    expect(Object.keys(serializeJob(withInternals as never, { images: true }).shots![0])).not.toEqual(
      expect.arrayContaining(["remoteId", "lastFrame", "startedAt"]),
    );
    expect(serializeJob(row({ status: "done", nextShot: 2 }) as never, { images: false }).shots).toBeUndefined();
  });

  it("keys owners by user or ip hash", () => {
    expect(ownerKeyFor({ userId: "a", ipHash: "h" })).toBe("u:a");
    expect(ownerKeyFor({ userId: null, ipHash: "h" })).toBe("ip:h");
  });
});
