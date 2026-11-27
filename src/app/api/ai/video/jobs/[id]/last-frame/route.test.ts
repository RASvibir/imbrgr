import { beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";

const { getActorMock, attachShotLastFrameMock } = vi.hoisted(() => ({
  getActorMock: vi.fn(),
  attachShotLastFrameMock: vi.fn(),
}));

vi.mock("@/lib/request-identity", () => ({ getActor: getActorMock }));
vi.mock("@/lib/user-guards", () => ({ assertUserMayUpload: vi.fn().mockResolvedValue(null) }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/lib/ai/video-job/service", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/video-job/service")>();
  return { ...actual, attachShotLastFrame: attachShotLastFrameMock };
});

import { POST } from "./route";

function uploadReq(file: File, shotIndex = "0") {
  const form = new FormData();
  form.append("file", file);
  form.append("shotIndex", shotIndex);
  return new Request("http://localhost/api/ai/video/jobs/j1/last-frame", {
    method: "POST",
    body: form,
  });
}

describe("POST /api/ai/video/jobs/[id]/last-frame", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getActorMock.mockResolvedValue({ userId: "user1", voterKey: "u:user1", ipHash: "h1" });
  });

  it("returns 401 for guest actors before checking upload guards or service", async () => {
    getActorMock.mockResolvedValueOnce({ userId: null, voterKey: "a:guest1", ipHash: "h1" });
    const file = new File([Buffer.from([1, 2, 3])], "frame.jpg", { type: "image/jpeg" });
    const res = await POST(uploadReq(file), { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(401);
    expect(attachShotLastFrameMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported mime types before calling service", async () => {
    const file = new File([Buffer.from("<svg/>")], "frame.svg", { type: "image/svg+xml" });
    const res = await POST(uploadReq(file), { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(400);
    expect(attachShotLastFrameMock).not.toHaveBeenCalled();
  });

  it("rejects oversized files before calling service", async () => {
    const big = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "frame.jpg", { type: "image/jpeg" });
    const res = await POST(uploadReq(big), { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(400);
    expect(attachShotLastFrameMock).not.toHaveBeenCalled();
  });

  it("returns 409 for mature jobs", async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();
    attachShotLastFrameMock.mockResolvedValueOnce({ ok: false, status: 409, error: "Mature clips can't be continued." });
    const file = new File([new Uint8Array(png)], "frame.png", { type: "image/png" });
    const res = await POST(uploadReq(file), { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(409);
  });

  it("returns 404 when job is not owned by the actor", async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();
    attachShotLastFrameMock.mockResolvedValueOnce({ ok: false, status: 404, error: "Video job not found" });
    const file = new File([new Uint8Array(png)], "frame.png", { type: "image/png" });
    const res = await POST(uploadReq(file), { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(404);
  });

  it("returns serialized job with canContinue=true on success", async () => {
    const png = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 10, g: 20, b: 30 } },
    })
      .png()
      .toBuffer();
    attachShotLastFrameMock.mockResolvedValueOnce({
      ok: true,
      job: {
        id: "j1",
        ownerKey: "u:user1",
        userId: "user1",
        ipHash: null,
        status: "done",
        input: { prompt: "p", aspectRatio: "16:9", mode: "video", durationSec: 5, motion: "zoom-in", seed: 1, mature: false },
        shots: [
          {
            durationSec: 5,
            visualPrompt: "p",
            motion: "zoom-in",
            videoUrl: "/api/media/file/v.mp4",
            mediaType: "video",
            lastFrame: "/api/media/file/f.jpg",
            lastFrameSource: "client",
          },
        ],
        nextShot: 1,
        error: null,
      },
    });

    const file = new File([new Uint8Array(png)], "frame.png", { type: "image/png" });
    const res = await POST(uploadReq(file), { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.job.canContinue).toBe(true);
    expect(data.job.shots[0].lastFrame).toBeUndefined();
    expect(data.job.shots[0].lastFrameSource).toBeUndefined();
  });
});
