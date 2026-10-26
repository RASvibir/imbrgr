export function userStorageQuotaBytes(): number {
  const raw = process.env.USER_STORAGE_QUOTA_BYTES;
  if (raw) return Number.parseInt(raw, 10);
  return 1024 * 1024 * 1024;
}

export function anonymousStorageQuotaBytes(): number {
  const raw = process.env.ANON_STORAGE_QUOTA_BYTES;
  if (raw) return Number.parseInt(raw, 10);
  return 50 * 1024 * 1024;
}

export function aiDailyLimit(): number {
  const raw = process.env.AI_DAILY_LIMIT;
  if (raw) return Number.parseInt(raw, 10);
  return 20;
}

export function anonAiDailyLimit(): number {
  const raw = process.env.ANON_AI_DAILY_LIMIT;
  if (raw) return Number.parseInt(raw, 10);
  return 5;
}

export function uploadRateLimitPerHour(): number {
  const raw = process.env.UPLOAD_RATE_LIMIT_PER_HOUR;
  if (raw) return Number.parseInt(raw, 10);
  return 60;
}

export function aiRateLimitPerHour(): number {
  const raw = process.env.AI_RATE_LIMIT_PER_HOUR;
  if (raw) return Number.parseInt(raw, 10);
  return 30;
}

/** Parses a positive integer env value; unset, blank, zero, negative or non-numeric values fall back. */
function positiveIntEnv(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Daily budget for storyboard planning by signed-in users, to protect free-tier provider quotas. */
export function videoPlanGlobalDailyLimit(): number {
  return positiveIntEnv("VIDEO_PLAN_GLOBAL_DAILY_LIMIT", 500);
}

/** Daily storyboard plans allowed per signed-out visitor (per hashed IP). */
export function videoPlanAnonIpDailyLimit(): number {
  return positiveIntEnv("VIDEO_PLAN_ANON_IP_DAILY_LIMIT", 3);
}

/** Shared daily pool for all signed-out visitors, so guests can't use up signed-in capacity. */
export function videoPlanAnonGlobalDailyLimit(): number {
  return positiveIntEnv("VIDEO_PLAN_ANON_GLOBAL_DAILY_LIMIT", 60);
}
