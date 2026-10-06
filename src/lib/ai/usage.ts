import { prisma } from "@/lib/db";
import { aiDailyLimit } from "@/lib/config";
import { remainingGenerations } from "@/lib/storage-quota";

function utcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getAiUsageToday(userId: string) {
  const day = utcDay();
  const row = await prisma.aiGenerationUsage.findUnique({
    where: { userId_day: { userId, day } },
  });
  const used = row?.count ?? 0;
  const limit = aiDailyLimit();
  return { used, limit, remaining: remainingGenerations(used, limit) };
}

/** Check only — does not increment (call before upstream). */
export async function assertCanGenerateAi(userId: string, needed = 1) {
  const { used, limit, remaining } = await getAiUsageToday(userId);
  if (remaining < needed || used + needed > limit) {
    throw new Error(`Daily AI limit reached (${limit}/day). Try again tomorrow.`);
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

export function generationsNeededForRequest(opts: { variations?: number }): number {
  const v = opts.variations ?? 1;
  return Math.max(1, Math.min(4, v));
}
