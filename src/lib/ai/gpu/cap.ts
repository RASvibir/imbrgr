import { consumeRateLimit, RateLimitError } from "@/lib/rate-limit";

const DEFAULT_DAILY_CAP = 60;
const WARN_FRACTION = 0.8;
const DAY_MS = 24 * 60 * 60 * 1000;

export function gpuDailyCap(env: Record<string, string | undefined> = process.env): number {
  const n = Number(env.VIDEO_GPU_DAILY_CAP);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_DAILY_CAP;
}

export function gpuCapKey(now: Date = new Date()): string {
  return `gpu-global-daily:${now.toISOString().slice(0, 10)}`;
}

export async function checkGpuDailyCap(now: Date = new Date()): Promise<void> {
  const cap = gpuDailyCap();
  let count: number;
  try {
    count = await consumeRateLimit(gpuCapKey(now), cap, DAY_MS);
  } catch (err) {
    if (err instanceof RateLimitError) throw new Error("gpu_daily_cap");
    console.error("[imbrgr/ai-video] gpu cap counter failed", err);
    throw new Error("gpu_cap_check_failed");
  }
  if (count === Math.ceil(cap * WARN_FRACTION)) {
    console.warn("[imbrgr/ai-video] gpu daily cap at 80 percent", { count, cap });
  }
}
