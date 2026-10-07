import { prisma } from "@/lib/db";
import {
  ARCHIVE_REASON_ACCOUNT_DELETED,
  archiveAndRemoveMedia,
  archiveAndRemovePost,
  type ArchiveOwnerInfo,
} from "@/lib/content-archive";
import { cleanupPostIfNoMedia } from "@/lib/post-cleanup";
import { deleteObject } from "@/lib/storage";
import { normalizeVisibility } from "@/lib/visibility";

export type DeleteAccountOptions = {
  /** When true, remove all posts from the public site (archived, not hard-deleted). */
  deleteAllPosts?: boolean;
};

function shouldKeepPostInGallery(post: { visibility: string }): boolean {
  return normalizeVisibility(post.visibility) === "PUBLIC";
}

export async function deleteUserAccount(userId: string, options?: DeleteAccountOptions) {
  const deleteAllPosts = options?.deleteAllPosts === true;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      posts: { include: { media: true } },
    },
  });
  if (!user) return;

  const owner: ArchiveOwnerInfo = {
    userId: user.id,
    username: user.username,
    email: user.email,
  };

  for (const post of user.posts) {
    if (deleteAllPosts) {
      await archiveAndRemovePost(post.id, owner, ARCHIVE_REASON_ACCOUNT_DELETED);
      continue;
    }
    if (shouldKeepPostInGallery(post)) {
      await prisma.post.update({ where: { id: post.id }, data: { userId: null } });
      await prisma.media.updateMany({
        where: { postId: post.id },
        data: { userId: null },
      });
    } else {
      await archiveAndRemovePost(post.id, owner, ARCHIVE_REASON_ACCOUNT_DELETED);
    }
  }

  const remainingMedia = await prisma.media.findMany({
    where: { userId },
  });
  for (const media of remainingMedia) {
    await archiveAndRemoveMedia(media.id, owner, ARCHIVE_REASON_ACCOUNT_DELETED);
    await cleanupPostIfNoMedia(media.postId);
  }

  if (user.avatarKey) await deleteObject(user.avatarKey).catch(() => undefined);
  if (user.bannerKey) await deleteObject(user.bannerKey).catch(() => undefined);

  await prisma.user.delete({ where: { id: userId } });
}
