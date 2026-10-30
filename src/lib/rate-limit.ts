import { prisma } from "@/lib/db";

/** Thrown when a bucket is exhausted (as opposed to an infrastructure failure). */
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

export async function consumeRateLimit(bucketKey: string, limit: number, windowMs: number): Promise<number> {
  const now = new Date();
  const row = await prisma.apiRateLimit.findUnique({ where: { bucketKey } });
  if (!row || row.resetAt <= now) {
    await prisma.apiRateLimit.upsert({
      where: { bucketKey },
      create: { bucketKey, count: 1, resetAt: new Date(now.getTime() + windowMs) },
      update: { count: 1, resetAt: new Date(now.getTime() + windowMs) },
    });
    return 1;
  }
  if (row.count >= limit) {
    throw new RateLimitError("We're plating as fast as we can — pause a moment and try again.");
  }
  const updated = await prisma.apiRateLimit.update({
    where: { bucketKey },
    data: { count: { increment: 1 } },
  });
  return updated?.count ?? row.count + 1;
}
