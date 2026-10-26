import { afterEach, describe, expect, it, vi } from "vitest";
import { videoPlanAnonGlobalDailyLimit, videoPlanAnonIpDailyLimit, videoPlanGlobalDailyLimit } from "@/lib/config";

const VARS = [
  "VIDEO_PLAN_GLOBAL_DAILY_LIMIT",
  "VIDEO_PLAN_ANON_IP_DAILY_LIMIT",
  "VIDEO_PLAN_ANON_GLOBAL_DAILY_LIMIT",
] as const;

describe("video plan limits config", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses defaults when unset", () => {
    for (const name of VARS) vi.stubEnv(name, "");
    expect(videoPlanGlobalDailyLimit()).toBe(500);
    expect(videoPlanAnonIpDailyLimit()).toBe(3);
    expect(videoPlanAnonGlobalDailyLimit()).toBe(60);
  });

  it("reads valid overrides", () => {
    vi.stubEnv("VIDEO_PLAN_GLOBAL_DAILY_LIMIT", "200");
    vi.stubEnv("VIDEO_PLAN_ANON_IP_DAILY_LIMIT", "5");
    vi.stubEnv("VIDEO_PLAN_ANON_GLOBAL_DAILY_LIMIT", "40");
    expect(videoPlanGlobalDailyLimit()).toBe(200);
    expect(videoPlanAnonIpDailyLimit()).toBe(5);
    expect(videoPlanAnonGlobalDailyLimit()).toBe(40);
  });

  it.each(["abc", "0", "-5", " "])("falls back to the default for the unusable value %j, never disabling the cap", (raw) => {
    for (const name of VARS) vi.stubEnv(name, raw);
    expect(videoPlanGlobalDailyLimit()).toBe(500);
    expect(videoPlanAnonIpDailyLimit()).toBe(3);
    expect(videoPlanAnonGlobalDailyLimit()).toBe(60);
  });
});
