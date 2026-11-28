import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, userUpdateMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  userUpdateMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ auth: authMock }));
vi.mock("@/lib/db", () => ({
  prisma: {
    user: { update: userUpdateMock },
  },
}));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("http://localhost:3000/api/me/age-verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/me/age-verify", () => {
  beforeEach(() => {
    authMock.mockReset();
    userUpdateMock.mockReset().mockResolvedValue({});
  });

  it("rejects unauthenticated requests with 401", async () => {
    authMock.mockResolvedValueOnce(null);
    const res = await POST(req({ birthDate: "1990-01-01", confirmAdult: true }));
    expect(res.status).toBe(401);
  });

  it("rejects invalid dates or missing attestation with 400", async () => {
    authMock.mockResolvedValue({ user: { id: "u1" } });
    const noConfirm = await POST(req({ birthDate: "1990-01-01", confirmAdult: false }));
    expect(noConfirm.status).toBe(400);

    const badDate = await POST(req({ birthDate: "2000-02-30", confirmAdult: true }));
    expect(badDate.status).toBe(400);
  });

  it("rejects users under 18 with 403", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1" } });
    const res = await POST(req({ birthDate: "2015-05-01", confirmAdult: true }));
    expect(res.status).toBe(403);
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("stores birthDate and adultVerifiedAt for verified 18+ users", async () => {
    authMock.mockResolvedValueOnce({ user: { id: "u1" } });
    const res = await POST(req({ birthDate: "1995-05-20", confirmAdult: true }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { ageVerified: boolean; birthDate: string };
    expect(json.ageVerified).toBe(true);
    expect(json.birthDate).toBe("1995-05-20");
    expect(userUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "u1" },
        data: expect.objectContaining({
          birthDate: new Date("1995-05-20T00:00:00.000Z"),
          adultVerifiedAt: expect.any(Date),
        }),
      }),
    );
  });
});
