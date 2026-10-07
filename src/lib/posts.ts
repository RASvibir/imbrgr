import { warmFeedThumbnails } from "@/lib/ensure-media-thumbnails";
import { prisma } from "@/lib/db";
import { feedPostHasImageMedia, filterPostsWithVisibleMedia } from "@/lib/post-feed-filter";
import { hotScore, topScore } from "@/lib/ranking";

export type FeedSort = "viral" | "newest" | "top";

export const postCardSelect = {
  id: true,
  shortId: true,
  title: true,
  description: true,
  score: true,
  upvoteCount: true,
  downvoteCount: true,
  viewCount: true,
  spiceScore: true,
  visibility: true,
  aiGenerated: true,
  createdAt: true,
  user: { select: { id: true, username: true } },
  media: {
    orderBy: { sortOrder: "asc" },
    take: 1,
    select: {
      id: true,
      shortId: true,
      mimeType: true,
      storageKey: true,
      width: true,
      height: true,
      thumbSmKey: true,
      thumbMdKey: true,
      placeholderCss: true,
      voterKey: true,
    },
  },
  tags: { include: { tag: { select: { slug: true, name: true } } } },
} as const;

export async function fetchFeed(params: {
  sort: FeedSort;
  cursor?: string;
  limit?: number;
  tagSlug?: string;
  visibility?: "PUBLIC" | "UNLISTED";
}) {
  const limit = params.limit ?? 12;
  const where: Record<string, unknown> = {
    visibility: params.visibility ?? "PUBLIC",
    hiddenByAdmin: false,
    ...feedPostHasImageMedia,
  };
  if (params.tagSlug) {
    where.tags = { some: { tag: { slug: params.tagSlug } } };
  }

  if (params.sort === "newest") {
    const posts = await prisma.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(params.cursor
        ? {
            cursor: { id: params.cursor },
            skip: 1,
          }
        : {}),
      select: postCardSelect,
    });
    const hasMore = posts.length > limit;
    const items = filterPostsWithVisibleMedia(hasMore ? posts.slice(0, limit) : posts);
    warmFeedThumbnails(items);
    return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
  }

  const batch = await prisma.post.findMany({
    where,
    take: 200,
    orderBy: { createdAt: "desc" },
    select: {
      ...postCardSelect,
      upvoteCount: true,
      downvoteCount: true,
      createdAt: true,
    },
  });

  const ranked = batch
    .map((p) => ({
      post: p,
      rank:
        params.sort === "top"
          ? topScore(p.upvoteCount, p.downvoteCount)
          : hotScore(p.upvoteCount, p.downvoteCount, p.createdAt),
    }))
    .sort((a, b) => b.rank - a.rank);

  let start = 0;
  if (params.cursor) {
    const idx = ranked.findIndex((r) => r.post.id === params.cursor);
    start = idx >= 0 ? idx + 1 : 0;
  }
  const slice = ranked.slice(start, start + limit + 1);
  const hasMore = slice.length > limit;
  const items = filterPostsWithVisibleMedia(
    (hasMore ? slice.slice(0, limit) : slice).map((r) => r.post),
  );
  warmFeedThumbnails(items);
  return { items, nextCursor: hasMore ? items[items.length - 1]?.id : null };
}

export async function searchPosts(query: string, limit = 24) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rows = await prisma.post.findMany({
    where: {
      visibility: "PUBLIC",
      hiddenByAdmin: false,
      ...feedPostHasImageMedia,
      OR: [
        { title: { contains: q } },
        { tags: { some: { tag: { OR: [{ slug: { contains: q } }, { name: { contains: q } }] } } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: postCardSelect,
  });
  return filterPostsWithVisibleMedia(rows);
}
