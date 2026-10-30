import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ consume: vi.fn() }));

vi.mock("@/lib/rate-limit", () => {
  class RateLimitError extends Error {}
  return { consumeRateLimit: mocks.consume, RateLimitError };
});

import { RateLimitError } from "@/lib/rate-limit";
import { checkGpuDailyCap, gpuCapKey, gpuDailyCap } from "./cap";

describe("gpu daily cap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("defaults to 60 and ignores invalid overrides", () => {
    expect(gpuDailyCap({})).toBe(60);
    expect(gpuDailyCap({ VIDEO_GPU_DAILY_CAP: "abc" })).toBe(60);
    expect(gpuDailyCap({ VIDEO_GPU_DAILY_CAP: "0" })).toBe(60);
    expect(gpuDailyCap({ VIDEO_GPU_DAILY_CAP: "-5" })).toBe(60);
    expect(gpuDailyCap({ VIDEO_GPU_DAILY_CAP: "2.5" })).toBe(60);
    expect(gpuDailyCap({ VIDEO_GPU_DAILY_CAP: "10" })).toBe(10);
  });

  it("keys the counter by UTC date", () => {
    expect(gpuCapKey(new Date("2026-10-29T23:59:59Z"))).toBe("gpu-global-daily:2026-10-29");
    expect(gpuCapKey(new Date("2026-10-30T00:00:01Z"))).toBe("gpu-global-daily:2026-10-30");
  });

  it("passes under the cap and consumes one unit", async () => {
    mocks.consume.mockResolvedValue(5);
    await expect(checkGpuDailyCap(new Date("2026-10-29T12:00:00Z"))).resolves.toBeUndefined();
    expect(mocks.consume).toHaveBeenCalledWith("gpu-global-daily:2026-10-29", 60, 86_400_000);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it("warns once at 80 percent", async () => {
    mocks.consume.mockResolvedValueOnce(47).mockResolvedValueOnce(48).mockResolvedValueOnce(49);
    await checkGpuDailyCap();
    await checkGpuDailyCap();
    await checkGpuDailyCap();
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it("throws gpu_daily_cap when the bucket is exhausted", async () => {
    mocks.consume.mockRejectedValue(new RateLimitError("full"));
    await expect(checkGpuDailyCap()).rejects.toThrow("gpu_daily_cap");
  });

  it("fails closed with gpu_cap_check_failed when the counter errors", async () => {
    mocks.consume.mockRejectedValue(new Error("db down"));
    await expect(checkGpuDailyCap()).rejects.toThrow("gpu_cap_check_failed");
  });
});
