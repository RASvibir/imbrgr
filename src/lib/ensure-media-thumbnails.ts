import { canViewMedia } from "@/lib/media-access";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/request-identity";
import { generateImageThumbnails } from "@/lib/thumbnails";
import { deleteObject, readLocalObject, readObject } from "@/lib/storage";

const systemActor: Actor = { userId: null, voterKey: "system", ipHash: "system" };

export async function ensureMediaThumbnails(mediaId: string): Promise<boolean> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    include: { post: { select: { userId: true, visibility: true, hiddenByAdmin: true } } },
  });
  if (!media || !media.mimeType.startsWith("image/")) return false;
  if (media.thumbSmKey && media.thumbMdKey) return true;
  if (!canViewMedia(media, systemActor)) return false;
  if (media.post?.hiddenByAdmin) return false;

  const data = (await readObject(media.storageKey)) ?? (await readLocalObject(media.storageKey));
  if (!data) return false;

  let thumbs;
  try {
    thumbs = await generateImageThumbnails(data);
  } catch {
    return false;
  }

  const applied = await prisma.media.updateMany({
    where: { id: mediaId, thumbMdKey: null },
    data: {
      thumbSmKey: thumbs.thumbSmKey,
      thumbMdKey: thumbs.thumbMdKey,
      placeholderCss: thumbs.placeholderCss,
    },
  });

  if (applied.count === 0) {
    await deleteObject(thumbs.thumbSmKey).catch(() => {});
    await deleteObject(thumbs.thumbMdKey).catch(() => {});
    return true;
  }
  return true;
}

/** Warm thumbnails for public feed cards (best-effort, capped per request). */
export async function warmFeedThumbnails(
  posts: { media: { id?: string; mimeType: string; thumbMdKey?: string | null }[] }[],
  max = 6,
) {
  let n = 0;
  for (const post of posts) {
    if (n >= max) break;
    const m = post.media[0];
    if (!m?.id || m.thumbMdKey || !m.mimeType.startsWith("image/")) continue;
    n++;
    await ensureMediaThumbnails(m.id);
  }
}
