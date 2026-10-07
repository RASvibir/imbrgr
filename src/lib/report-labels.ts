import { prisma } from "@/lib/db";

export async function reportTargetLabel(targetType: string, targetId: string): Promise<string> {
  switch (targetType) {
    case "POST": {
      const post = await prisma.post.findFirst({
        where: { OR: [{ id: targetId }, { shortId: targetId }] },
        select: { title: true, shortId: true },
      });
      return post ? `Post: ${post.title} (/p/${post.shortId})` : `Post ${targetId}`;
    }
    case "MEDIA": {
      const media = await prisma.media.findFirst({
        where: { OR: [{ id: targetId }, { shortId: targetId }] },
        select: { shortId: true, post: { select: { title: true } } },
      });
      return media
        ? `Image /i/${media.shortId}${media.post ? ` (${media.post.title})` : ""}`
        : `Media ${targetId}`;
    }
    case "COLLECTION": {
      const c = await prisma.collection.findFirst({
        where: { OR: [{ id: targetId }, { shortId: targetId }] },
        select: { title: true, shortId: true },
      });
      return c ? `Collection: ${c.title} (/c/${c.shortId})` : `Collection ${targetId}`;
    }
    case "USER": {
      const u = await prisma.user.findUnique({
        where: { id: targetId },
        select: { username: true },
      });
      return u ? `Profile @${u.username}` : `User ${targetId}`;
    }
    default:
      return `${targetType} ${targetId}`;
  }
}
