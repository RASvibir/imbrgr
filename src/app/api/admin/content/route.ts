import { NextResponse } from "next/server";
import { withSuperAdmin } from "@/lib/admin/api";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  return withSuperAdmin(async () => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    const posts = await prisma.post.findMany({
      where: q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { shortId: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      take: 60,
      include: {
        user: { select: { username: true } },
        media: { take: 1, orderBy: { sortOrder: "asc" } },
      },
    });
    const media = await prisma.media.findMany({
      where: q
        ? {
            OR: [{ shortId: { contains: q } }, { storageKey: { contains: q } }],
          }
        : undefined,
      orderBy: { id: "desc" },
      take: 60,
      include: {
        user: { select: { username: true } },
        post: { select: { shortId: true, title: true, visibility: true } },
      },
    });
    return NextResponse.json({ posts, media });
  });
}
