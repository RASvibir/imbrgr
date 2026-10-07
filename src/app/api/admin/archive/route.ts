import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  return withSuperAdmin(async () => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const posts = await prisma.archivedPost.findMany({
      where: q
        ? {
            OR: [
              { originalShortId: { contains: q } },
              { ownerUsername: { contains: q, mode: "insensitive" } },
              { ownerEmail: { contains: q, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { deletedAt: "desc" },
      take: 60,
      include: {
        media: {
          select: {
            id: true,
            originalShortId: true,
            storageKey: true,
            deletedAt: true,
          },
        },
      },
    });

    const orphanMedia = await prisma.archivedMedia.findMany({
      where: {
        archivedPostId: null,
        ...(q
          ? {
              OR: [
                { originalShortId: { contains: q } },
                { ownerUsername: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { deletedAt: "desc" },
      take: 30,
      select: {
        id: true,
        originalShortId: true,
        ownerUsername: true,
        reason: true,
        deletedAt: true,
        storageKey: true,
      },
    });

    return NextResponse.json({ posts, orphanMedia });
  });
}
