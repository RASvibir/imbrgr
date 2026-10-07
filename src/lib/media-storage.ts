import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";

export type MediaStorageKeys = {
  storageKey: string;
  thumbSmKey?: string | null;
  thumbMdKey?: string | null;
};

/** Remove original bytes and any generated thumbnails from object storage. */
export async function deleteMediaStorage(media: MediaStorageKeys): Promise<void> {
  await deleteObject(media.storageKey).catch(() => undefined);
  if (media.thumbSmKey) await deleteObject(media.thumbSmKey).catch(() => undefined);
  if (media.thumbMdKey) await deleteObject(media.thumbMdKey).catch(() => undefined);
}

export async function deleteAllMediaStorage(items: MediaStorageKeys[]): Promise<void> {
  for (const item of items) {
    await deleteMediaStorage(item);
  }
}

/** Drop thumbnail objects and clear DB thumb fields (e.g. when content becomes non-public). */
export async function purgeMediaThumbnails(media: {
  id: string;
  thumbSmKey?: string | null;
  thumbMdKey?: string | null;
}): Promise<void> {
  if (media.thumbSmKey) await deleteObject(media.thumbSmKey).catch(() => undefined);
  if (media.thumbMdKey) await deleteObject(media.thumbMdKey).catch(() => undefined);
  if (!media.thumbSmKey && !media.thumbMdKey) return;
  await prisma.media.update({
    where: { id: media.id },
    data: { thumbSmKey: null, thumbMdKey: null, placeholderCss: null },
  });
}

export async function purgePostMediaThumbnails(postId: string): Promise<void> {
  const rows = await prisma.media.findMany({
    where: { postId },
    select: { id: true, thumbSmKey: true, thumbMdKey: true },
  });
  for (const row of rows) {
    await purgeMediaThumbnails(row);
  }
}

export function collectUserStorageKeys(user: {
  avatarKey: string | null;
  bannerKey: string | null;
  posts: { media: MediaStorageKeys[] }[];
  mediaAssets: MediaStorageKeys[];
}): string[] {
  const keys = new Set<string>();
  for (const p of user.posts) {
    for (const m of p.media) {
      keys.add(m.storageKey);
      if (m.thumbSmKey) keys.add(m.thumbSmKey);
      if (m.thumbMdKey) keys.add(m.thumbMdKey);
    }
  }
  for (const m of user.mediaAssets) {
    keys.add(m.storageKey);
    if (m.thumbSmKey) keys.add(m.thumbSmKey);
    if (m.thumbMdKey) keys.add(m.thumbMdKey);
  }
  if (user.avatarKey) keys.add(user.avatarKey);
  if (user.bannerKey) keys.add(user.bannerKey);
  return [...keys];
}
