/** Posts in public feeds must have at least one image media row attached. */
export const feedPostHasImageMedia = {
  media: { some: { mimeType: { startsWith: "image/" } } },
} as const;

export type PostWithMediaSlice = { media: unknown[] };

export function filterPostsWithVisibleMedia<T extends PostWithMediaSlice>(items: T[]): T[] {
  return items.filter((p) => p.media.length > 0);
}
