import { prisma } from "@/lib/db";
import { contentTypeForKey } from "@/lib/media-types";
import { moveObjectToArchive } from "@/lib/storage";
import { removeAnonymousStorage, removeUserStorage } from "@/lib/storage-quota";

export const ARCHIVE_REASON_ACCOUNT_DELETED = "account_deleted_by_user";

export type ArchiveOwnerInfo = {
  userId: string;
  username: string;
  email: string;
};

type MediaRow = {
  id: string;
  shortId: string;
  postId: string | null;
  userId: string | null;
  voterKey: string | null;
  visibility: string;
  altText: string | null;
  mature: boolean;
  deleteTokenHash: string | null;
  parentMediaId: string | null;
  rootMediaId: string | null;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  sortOrder: number;
  aiGenerated: boolean;
  aiEdited: boolean;
  aiPrompt: string | null;
  thumbSmKey: string | null;
  thumbMdKey: string | null;
  placeholderCss: string | null;
};

async function archiveMediaFiles(media: MediaRow) {
  const storageKey = await moveObjectToArchive(
    media.storageKey,
    contentTypeForKey(media.storageKey, media.mimeType),
  );
  const thumbSmKey = media.thumbSmKey
    ? await moveObjectToArchive(media.thumbSmKey, "image/webp")
    : null;
  const thumbMdKey = media.thumbMdKey
    ? await moveObjectToArchive(media.thumbMdKey, "image/webp")
    : null;
  return { storageKey, thumbSmKey, thumbMdKey };
}

async function createArchivedMediaRecord(params: {
  media: MediaRow;
  owner: ArchiveOwnerInfo;
  reason: string;
  archivedPostId: string | null;
  archivedKeys: { storageKey: string; thumbSmKey: string | null; thumbMdKey: string | null };
}) {
  const { media, owner, reason, archivedPostId, archivedKeys } = params;
  const snapshot = {
    ...media,
    storageKey: archivedKeys.storageKey,
    thumbSmKey: archivedKeys.thumbSmKey,
    thumbMdKey: archivedKeys.thumbMdKey,
    originalStorageKey: media.storageKey,
    originalThumbSmKey: media.thumbSmKey,
    originalThumbMdKey: media.thumbMdKey,
  };
  return prisma.archivedMedia.create({
    data: {
      archivedPostId,
      originalMediaId: media.id,
      originalShortId: media.shortId,
      ownerUserId: owner.userId,
      ownerUsername: owner.username,
      reason,
      snapshot,
      storageKey: archivedKeys.storageKey,
      thumbSmKey: archivedKeys.thumbSmKey,
      thumbMdKey: archivedKeys.thumbMdKey,
    },
  });
}

async function adjustQuotaAfterMediaRemoved(media: MediaRow) {
  if (media.userId) await removeUserStorage(media.userId, media.byteSize);
  else if (media.voterKey) await removeAnonymousStorage(media.voterKey, media.byteSize);
}

/** Remove a live post from the site and retain rows + blobs in archive tables. */
export async function archiveAndRemovePost(
  postId: string,
  owner: ArchiveOwnerInfo,
  reason: string = ARCHIVE_REASON_ACCOUNT_DELETED,
) {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
    },
  });
  if (!post) return null;

  const postSnapshot = {
    ...post,
    media: undefined,
    tags: post.tags.map((pt) => ({ tagId: pt.tagId, tag: pt.tag })),
  };

  const archivedPost = await prisma.archivedPost.create({
    data: {
      originalPostId: post.id,
      originalShortId: post.shortId,
      ownerUserId: owner.userId,
      ownerUsername: owner.username,
      ownerEmail: owner.email,
      reason,
      snapshot: postSnapshot,
    },
  });

  for (const media of post.media) {
    const archivedKeys = await archiveMediaFiles(media);
    await createArchivedMediaRecord({
      media,
      owner,
      reason,
      archivedPostId: archivedPost.id,
      archivedKeys,
    });
    await adjustQuotaAfterMediaRemoved(media);
  }

  await prisma.post.delete({ where: { id: post.id } });
  return archivedPost;
}

/** Archive standalone media (no post) and remove the live row. */
export async function archiveAndRemoveMedia(
  mediaId: string,
  owner: ArchiveOwnerInfo,
  reason: string = ARCHIVE_REASON_ACCOUNT_DELETED,
) {
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media) return null;

  const archivedKeys = await archiveMediaFiles(media);
  const row = await createArchivedMediaRecord({
    media,
    owner,
    reason,
    archivedPostId: null,
    archivedKeys,
  });
  await adjustQuotaAfterMediaRemoved(media);
  await prisma.media.delete({ where: { id: media.id } });
  return row;
}
