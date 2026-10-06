import { prisma } from "@/lib/db";
import { aiDailyLimit } from "@/lib/config";
import { canGenerate, remainingGenerations } from "@/lib/storage-quota";

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
export async function assertCanGenerateAi(userId: string) {
  const { used, limit } = await getAiUsageToday(userId);
  if (!canGenerate(used, limit)) {
    throw new Error(`Daily AI limit reached (${limit}/day). Try again tomorrow.`);
  }
}

export async function recordAiGenerationSuccess(userId: string) {
  const day = utcDay();
  await prisma.aiGenerationUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count: 1 },
    update: { count: { increment: 1 } },
  });
}
