import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, updateMany, create } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  updateMany: vi.fn(),
  create: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { videoJob: { findUnique, updateMany, create } } }));
vi.mock("@/lib/ai/usage", () => ({
  recordAiGenerationSuccess: vi.fn(),
  recordAnonymousAiSuccess: vi.fn(),
}));

import { resolveContinuation, serializeJob, stepVideoJob } from "./service";
import type { ShotBackend } from "./backend";

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

  it("never exposes frames to the client", () => {
    const view = serializeJob(
      row({ shots: [{ durationSec: 8, visualPrompt: "a", motion: "zoom-in", lastFrame: "data:f", seedImage: "data:s" }] }),
      { images: true },
    );
    expect(view.shots?.[0]).not.toHaveProperty("lastFrame");
    expect(view.shots?.[0]).not.toHaveProperty("seedImage");
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
