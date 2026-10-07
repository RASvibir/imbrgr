import { warmFeedThumbnails } from "@/lib/ensure-media-thumbnails";
import { prisma } from "@/lib/db";
import { postCardSelect } from "@/lib/posts";

export async function fetchHotFeed(params: { cursor?: string; limit?: number }) {
  const limit = params.limit ?? 24;
  const offset = params.cursor?.startsWith("o:") ? Number.parseInt(params.cursor.slice(2), 10) || 0 : 0;
  const posts = await prisma.post.findMany({
    where: {
      visibility: "PUBLIC",
      hiddenByAdmin: false,
    },
    orderBy: [{ hotScore: "desc" }, { createdAt: "desc" }],
    skip: offset,
    take: limit + 1,
    select: postCardSelect,
  });
  const hasMore = posts.length > limit;
  const items = hasMore ? posts.slice(0, limit) : posts;
  warmFeedThumbnails(items);
  return { items, nextCursor: hasMore ? `o:${offset + limit}` : null };
}
