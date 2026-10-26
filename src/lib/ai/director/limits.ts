import {
  aiRateLimitPerHour,
  videoPlanAnonGlobalDailyLimit,
  videoPlanAnonIpDailyLimit,
  videoPlanGlobalDailyLimit,
} from "@/lib/config";
import { consumeRateLimit, RateLimitError } from "@/lib/rate-limit";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

export const GUEST_IP_LIMIT_MESSAGE = "You've used today's free guest plans — sign in to keep planning.";
export const GUEST_POOL_LIMIT_MESSAGE =
  "Guest planning is busy right now — sign in to keep planning, or try again tomorrow.";

export type PlanLimitResult = { ok: true } | { ok: false; status: 429; error: string };

type PlanActor = { userId: string | null; ipHash: string };

/** Runs one bucket check. Returns the limit message if the bucket is exhausted; rethrows real failures. */
async function tryConsume(
  key: string,
  limit: number,
  windowMs: number,
  messageOverride?: string,
): Promise<string | null> {
  try {
    await consumeRateLimit(key, limit, windowMs);
    return null;
  } catch (err) {
    if (err instanceof RateLimitError) return messageOverride ?? err.message;
    throw err;
  }
}

/**
 * Storyboard planning budgets. Signed-in users and guests draw from separate pools, so guest
 * traffic can never use up the capacity signed-in users rely on.
 *
 * - Signed-in: hourly cap per account, then a shared daily pool.
 * - Guest: daily cap per hashed IP, then a separate shared guest pool.
 */
export async function consumePlanLimits(actor: PlanActor): Promise<PlanLimitResult> {
  const checks: Array<[key: string, limit: number, windowMs: number, message?: string]> = actor.userId
    ? [
        [`ai-video-plan:user:${actor.userId}`, aiRateLimitPerHour(), HOUR_MS],
        ["ai-video-plan:global", videoPlanGlobalDailyLimit(), DAY_MS],
      ]
    : [
        [`ai-video-plan:anon-ip:${actor.ipHash}`, videoPlanAnonIpDailyLimit(), DAY_MS, GUEST_IP_LIMIT_MESSAGE],
        ["ai-video-plan:anon-global", videoPlanAnonGlobalDailyLimit(), DAY_MS, GUEST_POOL_LIMIT_MESSAGE],
      ];

  for (const [key, limit, windowMs, message] of checks) {
    const blocked = await tryConsume(key, limit, windowMs, message);
    if (blocked) return { ok: false, status: 429, error: blocked };
  }
  return { ok: true };
}
