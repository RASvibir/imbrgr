import { prisma } from "@/lib/db";
import { cleanupPostIfNoMedia, deletePostAndMedia } from "@/lib/post-cleanup";
import { deleteMediaStorage } from "@/lib/media-storage";
import { deleteObject } from "@/lib/storage";
import { removeUserStorage } from "@/lib/storage-quota";
import { normalizeVisibility } from "@/lib/visibility";

function shouldKeepPostInGallery(post: { visibility: string; hiddenByAdmin: boolean }): boolean {
  return normalizeVisibility(post.visibility) === "PUBLIC";
}

export async function deleteUserAccount(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      posts: { include: { media: true } },
    },
  });
  if (!user) return;

  const keptPostIds: string[] = [];

  for (const post of user.posts) {
    if (shouldKeepPostInGallery(post)) {
      keptPostIds.push(post.id);
      await prisma.post.update({ where: { id: post.id }, data: { userId: null } });
      await prisma.media.updateMany({
        where: { postId: post.id },
        data: { userId: null },
      });
    } else {
      await deletePostAndMedia(post.id);
    }
  }

  const remainingMedia = await prisma.media.findMany({
    where: { userId },
  });
  for (const media of remainingMedia) {
    await deleteMediaStorage(media);
    await removeUserStorage(userId, media.byteSize);
    await prisma.media.delete({ where: { id: media.id } });
    await cleanupPostIfNoMedia(media.postId);
  }

  if (user.avatarKey) await deleteObject(user.avatarKey).catch(() => undefined);
  if (user.bannerKey) await deleteObject(user.bannerKey).catch(() => undefined);

  await prisma.user.delete({ where: { id: userId } });
}
