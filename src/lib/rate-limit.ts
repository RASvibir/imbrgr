import { prisma } from "@/lib/db";

export async function consumeRateLimit(bucketKey: string, limit: number, windowMs: number): Promise<void> {
  const now = new Date();
  const row = await prisma.apiRateLimit.findUnique({ where: { bucketKey } });
  if (!row || row.resetAt <= now) {
    await prisma.apiRateLimit.upsert({
      where: { bucketKey },
      create: { bucketKey, count: 1, resetAt: new Date(now.getTime() + windowMs) },
      update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
    });
    return;
  }
  if (row.count >= limit) {
    throw new Error("We're plating as fast as we can — pause a moment and try again.");
  }
  await prisma.apiRateLimit.update({
    where: { bucketKey },
    data: { count: { increment: 1 } },
  });
}
