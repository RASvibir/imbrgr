import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const { findUnique, updateMany, update, create, putObjectMock, deleteObjectMock } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  update: vi.fn(),
  create: vi.fn(),
  putObjectMock: vi.fn(async (key: string, body: Buffer, contentType: string) => {
    void body;
    void contentType;
    return {
      key,
      url: `/api/media/file/${key}`,
    };
  }),
  deleteObjectMock: vi.fn(async (key: string) => {
    void key;
  }),
}));

vi.mock("@/lib/ai/gpu/cap", () => ({ checkGpuDailyCap: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/db", () => ({ prisma: { videoJob: { findUnique, updateMany, update, create } } }));
vi.mock("@/lib/storage", () => ({
  newStorageKey: (ext: string) => `captured-frame.${ext}`,
  putObject: putObjectMock,
  deleteObject: deleteObjectMock,
}));
vi.mock("@/lib/ai/usage", () => ({
  recordAiGenerationSuccess: vi.fn(),
  recordAnonymousAiSuccess: vi.fn(),
}));

import { attachShotLastFrame, MAX_LAST_FRAME_BYTES, resolveContinuation, serializeJob, stepVideoJob } from "./service";
import { assembledBackend, NOT_FRAME_CHAINED_LABEL, type ShotBackend } from "./backend";

const baseInput = {
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
    status: "done",
    input: baseInput,
    shots: [
      { durationSec: 4, visualPrompt: "a", motion: "zoom-in", videoUrl: "v1", lastFrame: "data:f1" },
      { durationSec: 4, visualPrompt: "b", motion: "zoom-in", videoUrl: "v2", lastFrame: "data:f2" },
    ],
    nextShot: 2,
    error: null,
    ...over,
  };
}

const actor = { userId: "user1", ipHash: "h" };

describe("serializeJob canContinue", () => {
  it("is true for a finished clip with a last frame", () => {
    expect(serializeJob(row(), { images: true }).canContinue).toBe(true);
  });

  it("is false when not done, mature, or without a last frame", () => {
    expect(serializeJob(row({ status: "running" }), { images: false }).canContinue).toBe(false);
    expect(serializeJob(row({ input: { ...baseInput, mature: true } }), { images: false }).canContinue).toBe(false);
    expect(
      serializeJob(row({ shots: [{ durationSec: 8, visualPrompt: "a", motion: "zoom-in" }] }), { images: false }).canContinue,
    ).toBe(false);
  });

  it("never exposes frames or frame sources to the client", () => {
    const view = serializeJob(
      row({
        shots: [
          {
            durationSec: 8,
            visualPrompt: "a",
            motion: "zoom-in",
            lastFrame: "data:f",
            lastFrameSource: "client",
            seedImage: "data:s",
            seedImageSource: "server",
          },
        ],
      }),
      { images: true },
    );
    expect(view.shots?.[0]).not.toHaveProperty("lastFrame");
    expect(view.shots?.[0]).not.toHaveProperty("lastFrameSource");
    expect(view.shots?.[0]).not.toHaveProperty("seedImage");
    expect(view.shots?.[0]).not.toHaveProperty("seedImageSource");
  });

  it("does not emit captureTarget for guest-owned jobs and allows prompt-only continuation", () => {
    const view = serializeJob(
      row({
        ownerKey: "ip:guest1",
        userId: null,
        ipHash: "guest1",
        status: "done",
        nextShot: 1,
        shots: [{ durationSec: 5, visualPrompt: "a", motion: "zoom-in", videoUrl: "/api/media/file/clip.mp4", mediaType: "video" }],
      }),
      { images: true },
    );
    expect(view.captureTarget).toBeUndefined();
    expect(view.canContinue).toBe(true);
  });
});

describe("resolveContinuation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the final shot's last frame", async () => {
    findUnique.mockResolvedValueOnce(row());
    expect(await resolveContinuation("j1", actor)).toEqual({ ok: true, lastFrame: "data:f2" });
  });

  it("is 404 for a job owned by someone else", async () => {
    findUnique.mockResolvedValueOnce(row({ ownerKey: "u:other" }));
    expect(await resolveContinuation("j1", actor)).toMatchObject({ ok: false, status: 404 });
  });

  it("is 409 while the job is still running", async () => {
    findUnique.mockResolvedValueOnce(row({ status: "running" }));
    expect(await resolveContinuation("j1", actor)).toMatchObject({ ok: false, status: 409 });
  });

  it("is 409 for mature clips and clips without a last frame", async () => {
    findUnique.mockResolvedValueOnce(row({ input: { ...baseInput, mature: true } }));
    expect(await resolveContinuation("j1", actor)).toMatchObject({ ok: false, status: 409 });
    findUnique.mockResolvedValueOnce(row({ shots: [{ durationSec: 8, visualPrompt: "a", motion: "zoom-in" }] }));
    expect(await resolveContinuation("j1", actor)).toMatchObject({ ok: false, status: 409 });
  });

  it("forces prompt-only continuation without lastFrame for guests", async () => {
    const guest = { userId: null, ipHash: "guest1" };
    findUnique.mockResolvedValueOnce(
      row({
        ownerKey: "ip:guest1",
        userId: null,
        ipHash: "guest1",
        shots: [{ durationSec: 5, visualPrompt: "a", motion: "zoom-in", lastFrame: "data:svg", lastFrameSource: "server" }],
      }),
    );
    expect(await resolveContinuation("j1", guest)).toEqual({ ok: true, promptOnly: true });
  });
});

describe("stepVideoJob seeding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
  });

  function gpuBackend() {
    const advanceShot = vi.fn().mockResolvedValue({ state: "pending", remoteId: "r1" });
    const backend: ShotBackend = {
      name: "t",
      tier: 3,
      isConfigured: () => true,
      renderShot: vi.fn(),
      advanceShot,
    };
    return { backend, advanceShot };
  }

  it("starts the first shot from the continuation seed image", async () => {
    const { backend, advanceShot } = gpuBackend();
    const queued = row({
      status: "queued",
      nextShot: 0,
      shots: [
        { durationSec: 4, visualPrompt: "a", motion: "zoom-in", seedImage: "data:seed" },
        { durationSec: 4, visualPrompt: "b", motion: "zoom-in" },
      ],
    });
    findUnique.mockResolvedValue(queued);
    await stepVideoJob("j1", actor, backend);
    expect(advanceShot).toHaveBeenCalledWith(expect.objectContaining({ initImage: "data:seed" }));
  });

  it("chains later shots from the previous last frame", async () => {
    const { backend, advanceShot } = gpuBackend();
    const running = row({
      status: "running",
      nextShot: 1,
      shots: [
        { durationSec: 4, visualPrompt: "a", motion: "zoom-in", seedImage: "data:seed", lastFrame: "data:f1" },
        { durationSec: 4, visualPrompt: "b", motion: "zoom-in" },
      ],
    });
    findUnique.mockResolvedValue(running);
    await stepVideoJob("j1", actor, backend);
    expect(advanceShot).toHaveBeenCalledWith(expect.objectContaining({ initImage: "data:f1" }));
  });

  it("passes no initImage when there is no seed", async () => {
    const { backend, advanceShot } = gpuBackend();
    findUnique.mockResolvedValue(
      row({ status: "queued", nextShot: 0, shots: [{ durationSec: 8, visualPrompt: "a", motion: "zoom-in" }] }),
    );
    await stepVideoJob("j1", actor, backend);
    expect(advanceShot).toHaveBeenCalledWith(expect.objectContaining({ initImage: undefined }));
  });
});

describe("last-frame capture and honest continuation labels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateMany.mockResolvedValue({ count: 1 });
  });

  it("emits captureTarget for a completed non-mature video shot missing lastFrame", () => {
    const view = serializeJob(
      row({
        status: "done",
        nextShot: 1,
        shots: [{ durationSec: 5, visualPrompt: "a", motion: "zoom-in", videoUrl: "/api/media/file/clip.mp4", mediaType: "video" }],
      }),
      { images: true },
    );
    expect(view.canContinue).toBe(false);
    expect(view.captureTarget).toEqual({ shotIndex: 0, videoUrl: "/api/media/file/clip.mp4" });
  });

  it("surfaces the not-frame-chained label in JobView for prompt-only continuations", () => {
    const view = serializeJob(
      row({
        status: "done",
        nextShot: 1,
        input: { ...baseInput, parentJobId: "parent-1", continueMode: "next-shot" },
        shots: [
          {
            durationSec: 5,
            visualPrompt: "Continuing from the previous frame",
            motion: "zoom-in",
            videoUrl: "/api/media/file/clip.mp4",
            mediaType: "video",
            frameChained: false,
            continuationFallback: NOT_FRAME_CHAINED_LABEL,
          },
        ],
      }),
      { images: true },
    );
    expect(view.continuationLabel).toBe("continued by prompt, not frame-chained");
    expect(view.shots?.[0]).not.toHaveProperty("continuationFallback");
    expect(view.shots?.[0]).not.toHaveProperty("frameChained");
  });

  it("validates ownership, mature flag, mime, size, and stores captured lastFrame via putObject", async () => {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 255, g: 120, b: 0 } },
    })
      .png()
      .toBuffer();

    findUnique.mockResolvedValueOnce(row({ ownerKey: "u:other" }));
    expect(
      await attachShotLastFrame({ jobId: "j1", actor, shotIndex: 0, buffer: png, mime: "image/png" }),
    ).toMatchObject({ ok: false, status: 404 });

    findUnique.mockResolvedValueOnce(row({ input: { ...baseInput, mature: true } }));
    expect(
      await attachShotLastFrame({ jobId: "j1", actor, shotIndex: 0, buffer: png, mime: "image/png" }),
    ).toMatchObject({ ok: false, status: 409 });

    const doneRow = row({
      status: "done",
      nextShot: 1,
      shots: [{ durationSec: 5, visualPrompt: "a", motion: "zoom-in", videoUrl: "/v1.mp4", mediaType: "video" }],
    });
    findUnique.mockResolvedValueOnce(doneRow);
    expect(
      await attachShotLastFrame({ jobId: "j1", actor, shotIndex: 0, buffer: png, mime: "image/svg+xml" }),
    ).toMatchObject({ ok: false, status: 400 });

    findUnique.mockResolvedValueOnce(doneRow);
    expect(
      await attachShotLastFrame({ jobId: "j1", actor, shotIndex: 0, buffer: Buffer.alloc(0), mime: "image/jpeg" }),
    ).toMatchObject({ ok: false, status: 400 });

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    findUnique.mockResolvedValueOnce(doneRow);
    const ok = await attachShotLastFrame({ jobId: "j1", actor, shotIndex: 0, buffer: png, mime: "image/png" });
    expect(ok.ok).toBe(true);
    expect(putObjectMock).toHaveBeenCalledWith("captured-frame.jpg", expect.any(Buffer), "image/jpeg");
    expect(infoSpy).toHaveBeenCalledWith(
      "[imbrgr/ai-video] last-frame uploaded",
      expect.objectContaining({
        jobId: "j1",
        userId: "user1",
        byteSize: expect.any(Number),
      }),
    );
    if (ok.ok) {
      const shots = ok.job.shots as { lastFrameSource?: string }[];
      expect(shots[0].lastFrameSource).toBe("client");
      const view = serializeJob(ok.job, { images: true });
      expect(view.canContinue).toBe(true);
      expect(view.captureTarget).toBeUndefined();
      expect(view.shots?.[0]).not.toHaveProperty("lastFrameSource");
    }
    infoSpy.mockRestore();
  });

  it("rejects guest actors with 401 in attachShotLastFrame", async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();
    const guest = { userId: null, ipHash: "guest1" };
    expect(
      await attachShotLastFrame({ jobId: "j1", actor: guest, shotIndex: 0, buffer: png, mime: "image/png" }),
    ).toMatchObject({ ok: false, status: 401 });
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("strips EXIF metadata from uploaded last-frame JPEGs", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const withExif = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 20, g: 40, b: 80 } },
    })
      .withExif({ IFD0: { ImageDescription: "secret-exif-marker", Software: "TestCam" } })
      .jpeg()
      .toBuffer();
    expect(withExif.includes("secret-exif-marker")).toBe(true);

    const doneRow = row({
      status: "done",
      nextShot: 1,
      shots: [{ durationSec: 5, visualPrompt: "a", motion: "zoom-in", videoUrl: "/v1.mp4", mediaType: "video" }],
    });
    findUnique.mockResolvedValueOnce(doneRow);

    const res = await attachShotLastFrame({ jobId: "j1", actor, shotIndex: 0, buffer: withExif, mime: "image/jpeg" });
    expect(res.ok).toBe(true);
    const storedBuf = putObjectMock.mock.calls[0]?.[1] as Buffer;
    expect(storedBuf.includes("secret-exif-marker")).toBe(false);
    const meta = await sharp(storedBuf).metadata();
    expect(meta.exif).toBeUndefined();
    infoSpy.mockRestore();
  });

  it("rejects frames exceeding byte size cap or 16MP pixel limit", async () => {
    const doneRow = row({
      status: "done",
      nextShot: 1,
      shots: [{ durationSec: 5, visualPrompt: "a", motion: "zoom-in", videoUrl: "/v1.mp4", mediaType: "video" }],
    });

    findUnique.mockResolvedValueOnce(doneRow);
    expect(
      await attachShotLastFrame({
        jobId: "j1",
        actor,
        shotIndex: 0,
        buffer: Buffer.alloc(MAX_LAST_FRAME_BYTES + 1, 1),
        mime: "image/jpeg",
      }),
    ).toMatchObject({ ok: false, status: 400 });

    // 5000x4000 = 20 megapixels, well under 5MB compressed but above 16MP limitInputPixels.
    const hugePixels = await sharp({
      create: { width: 5000, height: 4000, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer();
    findUnique.mockResolvedValueOnce(doneRow);
    expect(
      await attachShotLastFrame({
        jobId: "j1",
        actor,
        shotIndex: 0,
        buffer: hugePixels,
        mime: "image/png",
      }),
    ).toMatchObject({ ok: false, status: 400 });
  });

  it("guest continuation falls back to prompt-only with the not-frame-chained label", async () => {
    const guest = { userId: null, ipHash: "guest1" };
    const queued = row({
      ownerKey: "ip:guest1",
      userId: null,
      ipHash: "guest1",
      status: "queued",
      nextShot: 0,
      input: { ...baseInput, parentJobId: "parent-guest", continueMode: "extend" },
      shots: [{ durationSec: 5, visualPrompt: "Continuing from the previous frame", motion: "zoom-in" }],
    });
    let savedShots: unknown;
    findUnique.mockResolvedValueOnce(queued);
    updateMany.mockImplementationOnce(async ({ data }: { data: { shots: unknown } }) => {
      savedShots = data.shots;
      return { count: 1 };
    });
    findUnique.mockImplementationOnce(async () => ({ ...queued, status: "done", nextShot: 1, shots: savedShots }));

    const finished = await stepVideoJob("j1", guest, assembledBackend);
    const view = serializeJob(finished!, { images: true });
    expect(view.continuationLabel).toBe(NOT_FRAME_CHAINED_LABEL);
    expect(view.shots?.[0]).not.toHaveProperty("lastFrameSource");
  });

  it("does not pass client-sourced seedImage on guest jobs", async () => {
    const renderShot = vi.fn().mockResolvedValue({
      imageUrl: "data:image/svg+xml;utf8,<svg/>",
      mediaType: "image",
      frameChained: false,
      continuationFallback: NOT_FRAME_CHAINED_LABEL,
    });
    const assembled: ShotBackend = {
      name: "assembled-stills",
      tier: 1,
      supportsContinuation: true,
      isConfigured: () => true,
      renderShot,
    };
    const guest = { userId: null, ipHash: "guest1" };
    findUnique
      .mockResolvedValueOnce(
        row({
          ownerKey: "ip:guest1",
          userId: null,
          ipHash: "guest1",
          status: "queued",
          nextShot: 0,
          input: { ...baseInput, parentJobId: "parent-1", continueMode: "extend" },
          shots: [
            {
              durationSec: 5,
              visualPrompt: "Continuing",
              motion: "zoom-in",
              seedImage: "https://blob.example/tampered.jpg",
              seedImageSource: "client",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(row({ status: "done", nextShot: 1 }));

    await stepVideoJob("j1", guest, assembled);
    expect(renderShot).toHaveBeenCalledWith(
      expect.not.objectContaining({
        seedImage: expect.anything(),
        seedImageSource: expect.anything(),
      }),
    );
  });

  it("forwards seedImage, seedImageSource, and isContinuation to assembled renderShot", async () => {
    const renderShot = vi.fn().mockResolvedValue({
      videoUrl: "https://blob.example/next.mp4",
      mediaType: "video",
      frameChained: true,
    });
    const assembled: ShotBackend = {
      name: "assembled-stills",
      tier: 1,
      supportsContinuation: true,
      isConfigured: () => true,
      renderShot,
    };
    findUnique
      .mockResolvedValueOnce(
        row({
          status: "queued",
          nextShot: 0,
          input: { ...baseInput, parentJobId: "parent-1", continueMode: "extend" },
          shots: [
            {
              durationSec: 5,
              visualPrompt: "Continuing",
              motion: "zoom-in",
              seedImage: "https://blob.example/seed.jpg",
              seedImageSource: "client",
            },
          ],
        }),
      )
      .mockResolvedValueOnce(row({ status: "done", nextShot: 1 }));

    await stepVideoJob("j1", actor, assembled);
    expect(renderShot).toHaveBeenCalledWith(
      expect.objectContaining({
        seedImage: "https://blob.example/seed.jpg",
        seedImageSource: "client",
        isContinuation: true,
        seedFromParent: true,
        continueMode: "extend",
      }),
    );
  });

  it("returns 409 and writes nothing when the job advanced while capturing", async () => {
    const png = await sharp({
      create: { width: 16, height: 16, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer();
    const running = row({
      status: "running",
      nextShot: 1,
      shots: [
        { durationSec: 5, visualPrompt: "a", motion: "zoom-in", videoUrl: "/v1.mp4", mediaType: "video" },
        { durationSec: 5, visualPrompt: "b", motion: "zoom-in" },
      ],
    });
    findUnique.mockResolvedValueOnce(running);
    updateMany.mockResolvedValueOnce({ count: 0 });

    const res = await attachShotLastFrame({ jobId: "j1", actor, shotIndex: 0, buffer: png, mime: "image/png" });
    expect(res).toMatchObject({ ok: false, status: 409 });
    // The write is guarded on the nextShot we read, like commit() in stepVideoJob.
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "j1", nextShot: 1 } }));
    expect(update).not.toHaveBeenCalled();
    expect(deleteObjectMock).toHaveBeenCalledWith("captured-frame.jpg");
  });

  describe("continuation flags per shot", () => {
    function assembledMock() {
      const renderShot = vi.fn().mockResolvedValue({ imageUrl: "data:image/svg+xml;utf8,<svg/>", mediaType: "image" });
      const backend: ShotBackend = {
        name: "assembled-stills",
        tier: 1,
        supportsContinuation: true,
        isConfigured: () => true,
        renderShot,
      };
      return { backend, renderShot };
    }

    it("does not mark later shots of a normal job as continuations, but still chains the seed", async () => {
      const { backend, renderShot } = assembledMock();
      findUnique
        .mockResolvedValueOnce(
          row({
            status: "running",
            nextShot: 1,
            shots: [
              { durationSec: 4, visualPrompt: "a", motion: "zoom-in", lastFrame: "https://blob.example/f0.jpg", lastFrameSource: "server" },
              { durationSec: 4, visualPrompt: "b", motion: "zoom-in" },
            ],
          }),
        )
        .mockResolvedValueOnce(row({ status: "done", nextShot: 2 }));

      await stepVideoJob("j1", actor, backend);
      const args = renderShot.mock.calls[0][0];
      expect(args.seedImage).toBe("https://blob.example/f0.jpg");
      expect(args.isContinuation).toBeUndefined();
      expect(args.seedFromParent).toBeUndefined();
    });

    it("marks later shots of a continuation job as continuations but not seedFromParent", async () => {
      const { backend, renderShot } = assembledMock();
      findUnique
        .mockResolvedValueOnce(
          row({
            status: "running",
            nextShot: 1,
            input: { ...baseInput, parentJobId: "parent-1", continueMode: "extend" },
            shots: [
              { durationSec: 4, visualPrompt: "a", motion: "zoom-in", seedImage: "https://blob.example/seed.jpg", seedImageSource: "client", lastFrame: "https://blob.example/f0.jpg", lastFrameSource: "server" },
              { durationSec: 4, visualPrompt: "b", motion: "zoom-in" },
            ],
          }),
        )
        .mockResolvedValueOnce(row({ status: "done", nextShot: 2 }));

      await stepVideoJob("j1", actor, backend);
      const args = renderShot.mock.calls[0][0];
      expect(args.isContinuation).toBe(true);
      expect(args.seedFromParent).toBeUndefined();
    });
  });
});
