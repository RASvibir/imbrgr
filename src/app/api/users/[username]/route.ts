import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { postCardSelect } from "@/lib/posts";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ username: string }> },
) {
  const { username } = await ctx.params;
  const session = await auth();
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarKey: true,
      bannerKey: true,
      links: true,
      favoritesPublic: true,
      createdAt: true,
      posts: {
        where: { visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: 48,
        select: postCardSelect,
      },
      favorites: {
        orderBy: { createdAt: "desc" },
        take: 48,
        include: { post: { select: postCardSelect } },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 48,
        include: {
          post: { select: { shortId: true, title: true } },
        },
      },
      _count: {
        select: { posts: true, comments: true, favorites: true },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = session?.user?.id === user.id;
  const showFavorites = isOwner || user.favoritesPublic;

  const totalViews = await prisma.post.aggregate({
    where: { userId: user.id, visibility: "PUBLIC", hiddenByAdmin: false },
    _sum: { viewCount: true, spiceScore: true },
  });

  const remixes = await prisma.post.findMany({
    where: { userId: user.id, remixedFromPostId: { not: null }, visibility: "PUBLIC", hiddenByAdmin: false },
    orderBy: { createdAt: "desc" },
    take: 48,
    select: postCardSelect,
  });

  const collections = await prisma.collection.findMany({
    where: {
      userId: user.id,
      ...(isOwner ? {} : { visibility: "PUBLIC", hiddenByAdmin: false }),
    },
    orderBy: { createdAt: "desc" },
    take: 48,
    select: {
      id: true,
      shortId: true,
      title: true,
      description: true,
      visibility: true,
      _count: { select: { posts: true } },
    },
  });

  return NextResponse.json({
    ...user,
    favorites: showFavorites ? user.favorites : [],
    favoritesHidden: !showFavorites,
    stats: {
      posts: user._count.posts,
      comments: user._count.comments,
      favorites: showFavorites ? user._count.favorites : null,
      views: totalViews._sum.viewCount ?? 0,
      spice: totalViews._sum.spiceScore ?? 0,
    },
    remixes,
    collections,
  });
}
