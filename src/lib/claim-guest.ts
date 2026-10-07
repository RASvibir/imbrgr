import { prisma } from "@/lib/db";

/** Attach anonymous session content to a signed-in user after auth. */
export async function claimGuestContent(userId: string, voterKey: string) {
  if (!voterKey.startsWith("a:")) return { posts: 0, media: 0 };

  const media = await prisma.media.findMany({
    where: { voterKey, userId: null },
    select: { id: true, byteSize: true },
  });
  if (media.length) {
    await prisma.media.updateMany({
      where: { voterKey, userId: null },
      data: { userId, voterKey: null },
    });
    const bytes = media.reduce((s, m) => s + m.byteSize, 0);
    if (bytes > 0) {
      const { addUserStorage } = await import("@/lib/storage-quota");
      await addUserStorage(userId, bytes);
      const { removeAnonymousStorage } = await import("@/lib/storage-quota");
      await removeAnonymousStorage(voterKey, bytes);
    }
  }

  const posts = await prisma.post.updateMany({
    where: { userId: null, media: { some: { voterKey } } },
    data: { userId },
  });

  return { posts: posts.count, media: media.length };
}
