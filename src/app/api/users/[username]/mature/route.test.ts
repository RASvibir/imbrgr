import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, isUserAgeVerifiedMock, userFindUnique, postFindMany } = vi.hoisted(() => ({
  authMock: vi.fn(),
  isUserAgeVerifiedMock: vi.fn(),
  userFindUnique: vi.fn(),
  postFindMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/age-gate", () => ({ isUserAgeVerified: isUserAgeVerifiedMock }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: userFindUnique },
    post: { findMany: postFindMany },
  },
}));

import { GET } from "./route";

describe("GET /api/users/[username]/mature", () => {
  beforeEach(() => {
    authMock.mockReset();
    isUserAgeVerifiedMock.mockReset();
    userFindUnique.mockReset();
    postFindMany.mockReset().mockResolvedValue([]);
  });

  it("requires sign-in (401) and age verification (403)", async () => {
    authMock.mockResolvedValueOnce(null);
    const guestRes = await GET(new Request("http://localhost/api/users/alice/mature"), {
      params: Promise.resolve({ username: "alice" }),
    });
    expect(guestRes.status).toBe(401);

    authMock.mockResolvedValueOnce({ user: { id: "viewer-1" } });
    isUserAgeVerifiedMock.mockResolvedValueOnce(false);
    const unverifiedRes = await GET(new Request("http://localhost/api/users/alice/mature"), {
      params: Promise.resolve({ username: "alice" }),
    });
    expect(unverifiedRes.status).toBe(403);
    expect(postFindMany).not.toHaveBeenCalled();
  });

  it("returns mature posts for verified 18+ viewers", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "viewer-1" } });
    isUserAgeVerifiedMock.mockResolvedValueOnce(true);
    userFindUnique.mockResolvedValueOnce({ id: "creator-1", username: "alice", displayName: "Alice" });
    postFindMany.mockResolvedValueOnce([{ id: "p1", shortId: "abc123", title: "18+ Clip", media: [] }]);

    const res = await GET(new Request("http://localhost/api/users/alice/mature"), {
      params: Promise.resolve({ username: "alice" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as { username: string; isOwner: boolean; posts: { shortId: string }[] };
    expect(data.username).toBe("alice");
    expect(data.isOwner).toBe(false);
    expect(data.posts).toHaveLength(1);
    expect(postFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "creator-1",
          visibility: { in: ["PUBLIC", "UNLISTED"] },
          media: { some: expect.objectContaining({ mature: true }) },
        }),
      }),
    );
  });
});
