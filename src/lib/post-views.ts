import { prisma } from "@/lib/db";
import { isMediaOwner, isPostOwner } from "@/lib/media-access";
import type { Actor } from "@/lib/request-identity";
import { consumeRateLimit } from "@/lib/rate-limit";
import { spiceDeltaForView } from "@/lib/cheese-spice";

type PostForView = {
  id: string;
  userId: string | null;
  visibility: string;
  viewCount: number;
  spiceScore: number;
  media: { userId: string | null; voterKey: string | null; visibility: string }[];
};

export function shouldSkipOwnerView(post: PostForView, actor: Actor): boolean {
  if (isPostOwner(post, actor)) return true;
  if (!post.userId && post.media.some((m) => isMediaOwner(m, actor))) return true;
  return false;
}

export type RecordedPostView = {
  viewCount: number;
  spiceScore: number;
  recorded: boolean;
};

const VIEW_RATE_LIMIT = 90;
const VIEW_WINDOW_MS = 60_000;

export async function recordPostView(post: PostForView, actor: Actor): Promise<RecordedPostView> {
  const baseViews = post.viewCount ?? 0;
  const baseSpice = post.spiceScore ?? 0;

  if (shouldSkipOwnerView(post, actor)) {
    return { viewCount: baseViews, spiceScore: baseSpice, recorded: false };
  }

  try {
    await consumeRateLimit(`post-view:${post.id}:${actor.voterKey}`, VIEW_RATE_LIMIT, VIEW_WINDOW_MS);
  } catch {
    return { viewCount: baseViews, spiceScore: baseSpice, recorded: false };
  }

  const isAnonymous = !actor.userId;
  const existing = await prisma.postView.findUnique({
    where: { postId_voterKey: { postId: post.id, voterKey: actor.voterKey } },
  });

  const isRepeat = Boolean(existing);
  const delta = spiceDeltaForView(isAnonymous, isRepeat);

  if (!existing) {
    await prisma.$transaction([
      prisma.postView.create({
        data: {
          postId: post.id,
          voterKey: actor.voterKey,
          isAnonymous,
          hitCount: 1,
        },
      }),
      prisma.post.update({
        where: { id: post.id },
        data: {
          viewCount: { increment: 1 },
          ...(delta ? { spiceScore: { increment: delta } } : {}),
        },
      }),
    ]);
    return {
      viewCount: baseViews + 1,
      spiceScore: baseSpice + delta,
      recorded: true,
    };
  }

  await prisma.$transaction([
    prisma.postView.update({
      where: { id: existing.id },
      data: { hitCount: { increment: 1 } },
    }),
    prisma.post.update({
      where: { id: post.id },
      data: { spiceScore: { increment: delta } },
    }),
  ]);

  return {
    viewCount: baseViews,
    spiceScore: baseSpice + delta,
    recorded: true,
  };
}
