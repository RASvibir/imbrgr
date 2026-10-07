import { verifyDeleteToken } from "@/lib/anon-delete";
import { prisma } from "@/lib/db";
import { deleteAllMediaStorage } from "@/lib/media-storage";
import type { Actor } from "@/lib/request-identity";
import { isMediaOwner, isPostOwner } from "@/lib/media-access";
import { removeAnonymousStorage, removeUserStorage } from "@/lib/storage-quota";

export async function cleanupPostIfNoMedia(postId: string | null | undefined): Promise<boolean> {
  if (!postId) return false;
  const count = await prisma.media.count({ where: { postId } });
  if (count > 0) return false;
  await prisma.post.delete({ where: { id: postId } }).catch(() => undefined);
  return true;
}

export function isGuestPostOwner(
  post: { userId: string | null },
  media: { voterKey: string | null }[],
  actor: Actor,
): boolean {
  if (post.userId) return false;
  if (!actor.voterKey || media.length === 0) return false;
  return media.every((m) => m.voterKey === actor.voterKey);
}

export function canDeletePost(
  post: { userId: string | null; visibility?: string },
  media: { userId: string | null; voterKey: string | null; visibility?: string; deleteTokenHash: string | null }[],
  actor: Actor,
  deleteToken?: string | null,
): boolean {
  const postLike = { userId: post.userId, visibility: post.visibility ?? "PUBLIC" };
  if (isPostOwner(postLike, actor)) return true;
  if (isGuestPostOwner(post, media, actor)) return true;
  if (deleteToken && media.some((m) => verifyDeleteToken(deleteToken, m.deleteTokenHash))) return true;
  return media.length > 0 && media.every((m) => isMediaOwner({ ...m, visibility: m.visibility ?? "PUBLIC" }, actor));
}

export async function deletePostAndMedia(postId: string): Promise<void> {
  const post = await prisma.post.findUnique({
    where: { id: postId },
    include: { media: true },
  });
  if (!post) return;
  await deleteAllMediaStorage(post.media);
  for (const m of post.media) {
    if (m.userId) await removeUserStorage(m.userId, m.byteSize);
    else if (m.voterKey) await removeAnonymousStorage(m.voterKey, m.byteSize);
  }
  await prisma.post.delete({ where: { id: post.id } });
}
