import { canViewMedia } from "@/lib/media-access";
import { prisma } from "@/lib/db";
import type { Actor } from "@/lib/request-identity";
import { scheduleAfterResponse } from "@/lib/schedule-after-response";
import { generateImageThumbnails } from "@/lib/thumbnails";
import { deleteObject, readLocalObject, readObject } from "@/lib/storage";

const systemActor: Actor = { userId: null, voterKey: "system", ipHash: "system" };

const inFlight = new Map<string, Promise<boolean>>();

async function ensureMediaThumbnailsOnce(mediaId: string): Promise<boolean> {
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
    // Thumbnail bytes are stored via putObject() → configured STORAGE_DRIVER (blob on Vercel).
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

/** Generate missing thumbs for one media row (deduped while in flight). */
export async function ensureMediaThumbnails(mediaId: string): Promise<boolean> {
  const existing = inFlight.get(mediaId);
  if (existing) return existing;

  const work = ensureMediaThumbnailsOnce(mediaId).finally(() => {
    inFlight.delete(mediaId);
  });
  inFlight.set(mediaId, work);
  return work;
}

type FeedPostForWarm = {
  media: { id?: string; mimeType: string; thumbMdKey?: string | null }[];
};

/**
 * Best-effort thumbnail warm for feed cards. Returns immediately; work runs after the response via `after()`.
 * No-op outside a Next.js request (e.g. unit tests, CLI scripts).
 */
export function warmFeedThumbnails(posts: FeedPostForWarm[], max = 6): void {
  const ids: string[] = [];
  for (const post of posts) {
    if (ids.length >= max) break;
    const m = post.media[0];
    if (!m?.id || m.thumbMdKey || !m.mimeType.startsWith("image/")) continue;
    ids.push(m.id);
  }
  if (ids.length === 0) return;

  scheduleAfterResponse(async () => {
    for (const id of ids) {
      await ensureMediaThumbnails(id).catch(() => false);
    }
  });
}
