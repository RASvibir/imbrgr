import { prisma } from "@/lib/db";
import { purgeMediaThumbnails, purgePostMediaThumbnails } from "@/lib/media-storage";

/** When a post must not be publicly cacheable, remove thumbnail blobs from storage. */
export async function onPostRestrictedAccess(postId: string): Promise<void> {
  await purgePostMediaThumbnails(postId);
}

export async function onStandaloneMediaRestricted(mediaId: string): Promise<void> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: { id: true, thumbSmKey: true, thumbMdKey: true, postId: true },
  });
  if (!media || media.postId) return;
  await purgeMediaThumbnails(media);
}
