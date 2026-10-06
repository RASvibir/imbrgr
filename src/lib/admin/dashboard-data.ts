import { prisma } from "@/lib/db";

function utcDay(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getAdminDashboardData() {
  const day = utcDay();
  const [
    users,
    posts,
    media,
    storageAgg,
    aiSigned,
    aiAnon,
    recentUsers,
    openReports,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.post.count(),
    prisma.media.count(),
    prisma.user.aggregate({ _sum: { storageBytesUsed: true } }),
    prisma.aiGenerationUsage.aggregate({ where: { day }, _sum: { count: true } }),
    prisma.aiAnonymousUsage.aggregate({ where: { day }, _sum: { count: true } }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, username: true, email: true, createdAt: true, role: true },
    }),
    prisma.report.count({ where: { status: "OPEN" } }),
  ]);
  const anonStorage = await prisma.anonymousStorage.aggregate({ _sum: { bytesUsed: true } });
  const cacheTotal = await prisma.aiPromptCache.count();
  const cacheRecent = await prisma.aiPromptCache.count({
    where: { lastUsedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  return {
    users,
    posts,
    media,
    storageBytesSignedIn: storageAgg._sum.storageBytesUsed?.toString() ?? "0",
    storageBytesAnonymous: anonStorage._sum.bytesUsed?.toString() ?? "0",
    aiGenerationsTodaySignedIn: aiSigned._sum.count ?? 0,
    aiGenerationsTodayAnonymous: aiAnon._sum.count ?? 0,
    openReports,
    promptCacheEntries: cacheTotal,
    promptCacheHits24h: cacheRecent,
    recentSignups: recentUsers,
  };
}
