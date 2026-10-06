import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";

export async function deleteUserAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      posts: { include: { media: true } },
      mediaAssets: true,
    },
  });
  if (!user) return;

  const keys = new Set<string>();
  for (const p of user.posts) {
    for (const m of p.media) keys.add(m.storageKey);
  }
  for (const m of user.mediaAssets) keys.add(m.storageKey);
  if (user.avatarKey) keys.add(user.avatarKey);
  if (user.bannerKey) keys.add(user.bannerKey);

  for (const key of keys) {
    await deleteObject(key);
  }

  await prisma.user.delete({ where: { id: userId } });
}
