import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  getActor: vi.fn(),
  findPost: vi.fn(),
  findComment: vi.fn(),
  createComment: vi.fn(),
  guard: vi.fn(),
  rate: vi.fn(),
  canView: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/request-identity", () => ({ getActor: mocks.getActor }));
vi.mock("@/lib/db", () => ({
  prisma: {
    post: { findUnique: mocks.findPost },
    comment: { findUnique: mocks.findComment, create: mocks.createComment },
  },
}));
vi.mock("@/lib/media-access", () => ({ canViewPost: mocks.canView }));
vi.mock("@/lib/user-guards", () => ({ assertUserMayComment: mocks.guard }));
vi.mock("@/lib/rate-limit", () => ({ consumeRateLimit: mocks.rate }));

import { POST } from "./route";

function call(body: unknown) {
  return POST(
    new Request("http://localhost/api/posts/abc/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ shortId: "abc" }) },
  );
}

describe("POST /api/posts/[shortId]/comments error codes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mocks.auth.mockResolvedValue(null);
    mocks.getActor.mockResolvedValue({ userId: null, ipHash: "h" });
    mocks.findPost.mockResolvedValue({ id: "p1", hiddenByAdmin: false, media: [] });
    mocks.canView.mockReturnValue(true);
    mocks.guard.mockResolvedValue(null);
    mocks.rate.mockResolvedValue(undefined);
    mocks.findComment.mockResolvedValue({ id: "c1", postId: "p1" });
    mocks.createComment.mockResolvedValue({ id: "new", body: "ok" });
  });

  it("returns not_found for a missing post", async () => {
    mocks.findPost.mockResolvedValue(null);
    const res = await call({ body: "hi" });
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe("not_found");
  });

  it("returns forbidden when the user guard blocks", async () => {
    mocks.guard.mockResolvedValue("Commenting is disabled");
    const res = await call({ body: "hi" });
    expect(res.status).toBe(403);
    expect((await res.json()).code).toBe("forbidden");
  });

  it("returns rate_limited", async () => {
    mocks.rate.mockRejectedValue(new Error("limit"));
    const res = await call({ body: "hi" });
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("rate_limited");
  });

  it("returns invalid for a bad schema", async () => {
    const res = await call({ body: "" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid");
  });

  it("returns blocked and logs the check without the body", async () => {
    const res = await call({ body: "csam" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("blocked");
    const warn = console.warn as unknown as ReturnType<typeof vi.fn>;
    expect(warn).toHaveBeenCalledWith("[imbrgr/comments] rejected", {
      check: "content_child_safety",
      postShortId: "abc",
      actor: "guest",
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain("csam");
  });

  it("returns parent for a parent on another post", async () => {
    mocks.findComment.mockResolvedValue({ id: "c1", postId: "other" });
    const res = await call({ body: "hi", parentId: "c1" });
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("parent");
  });

  it("accepts a clean top-level comment with null parentId", async () => {
    const res = await call({ body: "nice", parentId: null });
    expect(res.status).toBe(200);
  });
});
