import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  return withSuperAdmin(async () => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { username: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        banned: true,
        suspended: true,
        storageBytesUsed: true,
        storageQuotaBytesOverride: true,
        aiDailyLimitOverride: true,
        createdAt: true,
        _count: { select: { posts: true, mediaAssets: true } },
      },
    });
    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        storageBytesUsed: u.storageBytesUsed.toString(),
        storageQuotaBytesOverride: u.storageQuotaBytesOverride?.toString() ?? null,
      })),
    });
  });
}
