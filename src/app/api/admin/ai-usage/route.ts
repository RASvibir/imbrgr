import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api";
import { prisma } from "@/lib/db";

export async function GET() {
  return withSuperAdmin(async () => {
    const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const [signed, anon, cacheTotal, cacheUsed] = await Promise.all([
      prisma.aiGenerationUsage.findMany({
        where: { day: { gte: since } },
        orderBy: { day: "asc" },
      }),
      prisma.aiAnonymousUsage.findMany({
        where: { day: { gte: since } },
        orderBy: { day: "asc" },
      }),
      prisma.aiPromptCache.count(),
      prisma.aiPromptCache.count({
        where: { lastUsedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
    ]);
    return NextResponse.json({
      signedInByDay: signed,
      anonymousByDay: anon,
      promptCache: {
        totalEntries: cacheTotal,
        usedLast24h: cacheUsed,
        hitRateEstimate: cacheTotal > 0 ? cacheUsed / cacheTotal : 0,
      },
    });
  });
}
