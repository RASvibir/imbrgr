import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getActorMock,
  assertUserMayUploadMock,
  getVideoJobMock,
  readObjectMock,
  processAndStoreUploadMock,
  postCreateMock,
  postDeleteMock,
  userFindUniqueMock,
} = vi.hoisted(() => ({
  getActorMock: vi.fn(),
  assertUserMayUploadMock: vi.fn(),
  getVideoJobMock: vi.fn(),
  readObjectMock: vi.fn(),
  processAndStoreUploadMock: vi.fn(),
  postCreateMock: vi.fn(),
  postDeleteMock: vi.fn(),
  userFindUniqueMock: vi.fn(),
}));

vi.mock("@/lib/request-identity", () => ({ getActor: getActorMock }));
vi.mock("@/lib/user-guards", () => ({ assertUserMayUpload: assertUserMayUploadMock }));
vi.mock("@/lib/ai/video-job/service", () => ({ getVideoJob: getVideoJobMock }));
vi.mock("@/lib/storage", () => ({ readObject: readObjectMock }));
vi.mock("@/lib/media-save", () => ({ processAndStoreUpload: processAndStoreUploadMock }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: userFindUniqueMock },
    post: { create: postCreateMock, delete: postDeleteMock },
    tag: { upsert: vi.fn() },
    postTag: { createMany: vi.fn() },
  },
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost/api/ai/video/jobs/j1/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/ai/video/jobs/[id]/publish", () => {
  beforeEach(() => {
    getActorMock.mockReset().mockResolvedValue({ userId: "u1", voterKey: "u:u1", ipHash: "h1" });
    assertUserMayUploadMock.mockReset().mockResolvedValue(null);
    getVideoJobMock.mockReset();
    readObjectMock.mockReset();
    processAndStoreUploadMock.mockReset().mockResolvedValue({ id: "m1" });
    postCreateMock.mockReset().mockResolvedValue({ id: "post-1", shortId: "vid123" });
    postDeleteMock.mockReset().mockResolvedValue({});
    userFindUniqueMock.mockReset().mockResolvedValue({ defaultPostVisibility: "PUBLIC" });
  });

  it("returns 404 for missing job and 409 when job is not done", async () => {
    getVideoJobMock.mockResolvedValueOnce(null);
    const missing = await POST(req({}), { params: Promise.resolve({ id: "j1" }) });
    expect(missing.status).toBe(404);

    getVideoJobMock.mockResolvedValueOnce({ id: "j1", status: "running", input: {}, shots: [] });
    const running = await POST(req({}), { params: Promise.resolve({ id: "j1" }) });
    expect(running.status).toBe(409);
  });

  it("publishes a completed video shot to Post and clamps mature posts to UNLISTED", async () => {
    getVideoJobMock.mockResolvedValueOnce({
      id: "j1",
      status: "done",
      input: { prompt: "uncensored clip", mature: true },
      shots: [{ videoUrl: "/api/media/file/clip-1.mp4", mediaType: "video" }],
    });
    readObjectMock.mockResolvedValueOnce(Buffer.from("mp4-bytes"));

    const res = await POST(req({ visibility: "PUBLIC" }), { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { shortId: string; pageUrl: string; visibility: string; mature: boolean };
    expect(data).toEqual({
      shortId: "vid123",
      pageUrl: "/p/vid123",
      visibility: "UNLISTED",
      mature: true,
    });
    expect(processAndStoreUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mime: "video/mp4",
        postId: "post-1",
        visibility: "UNLISTED",
        mature: true,
      }),
    );
  });

  it("rasterizes utf8 SVG mock keyframes containing unescaped % attributes", async () => {
    getVideoJobMock.mockResolvedValueOnce({
      id: "j1",
      status: "done",
      input: { prompt: "sizzling ramen", mature: false },
      shots: [
        {
          imageUrl:
            'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="100%" height="100%" fill="%231a1a24"/></svg>',
          mediaType: "image",
        },
      ],
    });

    const res = await POST(req({}), { params: Promise.resolve({ id: "j1" }) });
    expect(res.status).toBe(200);
    expect(processAndStoreUploadMock).toHaveBeenCalledWith(
      expect.objectContaining({
        mime: "image/png",
        mature: false,
      }),
    );
  });
});
