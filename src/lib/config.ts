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
