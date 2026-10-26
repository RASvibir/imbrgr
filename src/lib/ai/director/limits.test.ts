import { beforeEach, describe, expect, it, vi } from "vitest";

const consume = vi.fn();

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/config", () => ({
  aiRateLimitPerHour: () => 30,
  videoPlanGlobalDailyLimit: () => 200,
  videoPlanAnonIpDailyLimit: () => 3,
  videoPlanAnonGlobalDailyLimit: () => 60,
}));
vi.mock("@/lib/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/rate-limit")>()),
  consumeRateLimit: (...args: unknown[]) => consume(...args),
}));

import { RateLimitError } from "@/lib/rate-limit";
import { consumePlanLimits, GUEST_IP_LIMIT_MESSAGE, GUEST_POOL_LIMIT_MESSAGE } from "./limits";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe("consumePlanLimits", () => {
  beforeEach(() => {
    consume.mockReset();
    consume.mockResolvedValue(undefined);
  });

  it("charges signed-in users an hourly account bucket and the signed-in daily pool", async () => {
    const result = await consumePlanLimits({ userId: "u1", ipHash: "ip1" });
    expect(result).toEqual({ ok: true });
    expect(consume.mock.calls).toEqual([
      ["ai-video-plan:user:u1", 30, HOUR],
      ["ai-video-plan:global", 200, DAY],
    ]);
  });

  it("charges guests a per-IP daily bucket and a separate guest pool, never the signed-in pool", async () => {
    const result = await consumePlanLimits({ userId: null, ipHash: "ip1" });
    expect(result).toEqual({ ok: true });
    expect(consume.mock.calls).toEqual([
      ["ai-video-plan:anon-ip:ip1", 3, DAY],
      ["ai-video-plan:anon-global", 60, DAY],
    ]);
  });

  it("returns a sign-in message when a guest hits the per-IP cap, without touching the guest pool", async () => {
    consume.mockRejectedValueOnce(new RateLimitError("slow down"));
    const result = await consumePlanLimits({ userId: null, ipHash: "ip1" });
    expect(result).toEqual({ ok: false, status: 429, error: GUEST_IP_LIMIT_MESSAGE });
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it("returns a sign-in message when the guest pool is exhausted", async () => {
    consume.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new RateLimitError("slow down"));
    const result = await consumePlanLimits({ userId: null, ipHash: "ip1" });
    expect(result).toEqual({ ok: false, status: 429, error: GUEST_POOL_LIMIT_MESSAGE });
  });

  it("keeps the account bucket's own message for signed-in users and skips the daily pool", async () => {
    consume.mockRejectedValueOnce(new RateLimitError("pause a moment"));
    const result = await consumePlanLimits({ userId: "u1", ipHash: "ip1" });
    expect(result).toEqual({ ok: false, status: 429, error: "pause a moment" });
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it("signed-in users still plan when every guest bucket is exhausted", async () => {
    consume.mockImplementation(async (key: string) => {
      if (key.startsWith("ai-video-plan:anon")) throw new RateLimitError("exhausted");
    });
    expect(await consumePlanLimits({ userId: null, ipHash: "ip1" })).toMatchObject({ ok: false });
    expect(await consumePlanLimits({ userId: "u1", ipHash: "ip1" })).toEqual({ ok: true });
  });

  it("rethrows infrastructure failures instead of reporting them as a rate limit", async () => {
    consume.mockRejectedValueOnce(new Error("connection refused"));
    await expect(consumePlanLimits({ userId: null, ipHash: "ip1" })).rejects.toThrow("connection refused");
  });
});
