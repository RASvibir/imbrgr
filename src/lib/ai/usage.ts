import { prisma } from "@/lib/db";
import { aiDailyLimit, anonAiDailyLimit } from "@/lib/config";
import { getSiteSettings } from "@/lib/site-settings";
import { remainingGenerations } from "@/lib/storage-quota";

function utcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getAiUsageToday(userId: string) {
  const day = utcDay();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { aiDailyLimitOverride: true },
  });
  const row = await prisma.aiGenerationUsage.findUnique({
    where: { userId_day: { userId, day } },
  });
  const used = row?.count ?? 0;
  const limit = user?.aiDailyLimitOverride ?? aiDailyLimit();
  return { used, limit, remaining: remainingGenerations(used, limit), type: "user" as const };
}

export async function getAnonymousAiUsageToday(ipHash: string) {
  const day = utcDay();
  const settings = await getSiteSettings();
  const row = await prisma.aiAnonymousUsage.findUnique({
    where: { ipHash_day: { ipHash, day } },
  });
  const used = row?.count ?? 0;
  const limit = settings.anonAiDailyLimit ?? anonAiDailyLimit();
  return { used, limit, remaining: remainingGenerations(used, limit), type: "anonymous" as const };
}

/** Check only — does not increment (call before upstream). */
export async function assertCanGenerateAiForUser(userId: string, needed = 1) {
  const { used, limit, remaining } = await getAiUsageToday(userId);
  if (remaining < needed || used + needed > limit) {
    throw new Error("The kitchen's resting for today — swing by tomorrow, or sign in to keep cooking.");
  }
}

export async function assertCanGenerateAiForAnonymous(ipHash: string, needed = 1) {
  const { used, limit, remaining } = await getAnonymousAiUsageToday(ipHash);
  if (remaining < needed || used + needed > limit) {
    throw new Error("The kitchen's resting for today — swing by tomorrow, or sign in to keep cooking.");
  }
}

export async function recordAiGenerationSuccess(userId: string, count = 1) {
  const day = utcDay();
  await prisma.aiGenerationUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count },
    update: { count: { increment: count } },
  });
}

export async function recordAnonymousAiSuccess(ipHash: string, count = 1) {
  const day = utcDay();
  await prisma.aiAnonymousUsage.upsert({
    where: { ipHash_day: { ipHash, day } },
    create: { ipHash, day, count },
    update: { count: { increment: count } },
  });
}

export function generationsNeededForRequest(opts: { variations?: number }): number {
  const v = opts.variations ?? 1;
  return Math.max(1, Math.min(4, v));
}

/** @deprecated use assertCanGenerateAiForUser */
export async function assertCanGenerateAi(userId: string, needed = 1) {
  return assertCanGenerateAiForUser(userId, needed);
}
