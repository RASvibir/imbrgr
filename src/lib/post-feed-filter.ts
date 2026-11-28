import type { Prisma } from "@/generated/prisma/client";

/** Posts in public feeds must have at least one image or video media row attached. */
export const feedPostHasMedia: Prisma.PostWhereInput = {
  media: {
    some: {
      OR: [{ mimeType: { startsWith: "image/" } }, { mimeType: { startsWith: "video/" } }],
    },
  },
};

export const feedPostHasImageMedia = feedPostHasMedia;

export type PostWithMediaSlice = { media: unknown[] };

export function filterPostsWithVisibleMedia<T extends PostWithMediaSlice>(items: T[]): T[] {
  return items.filter((p) => p.media.length > 0);
}

export function postHasVisibleMedia(media: { mimeType: string }[]): boolean {
  return media.some((m) => m.mimeType.startsWith("image/") || m.mimeType.startsWith("video/"));
}

export const postHasImageMedia = postHasVisibleMedia;
