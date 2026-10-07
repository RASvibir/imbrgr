import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PostDetail } from "@/components/posts/PostDetail";
import { prisma } from "@/lib/db";
import { buildPostPageMetadata } from "@/lib/og";
import { postHasImageMedia } from "@/lib/post-feed-filter";
import { postUrl } from "@/lib/urls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>;
}): Promise<Metadata> {
  const { shortId } = await params;
  const post = await prisma.post.findUnique({
    where: { shortId },
    include: {
      media: {
        where: { mimeType: { startsWith: "image/" } },
        orderBy: { sortOrder: "asc" },
        take: 1,
      },
    },
  });
  if (!post || !postHasImageMedia(post.media)) {
    return { title: "Not found" };
  }
  const primary = post.media[0] ?? null;
  return buildPostPageMetadata(post, primary, postUrl(shortId));
}

export default async function PostPage({ params }: { params: Promise<{ shortId: string }> }) {
  const { shortId } = await params;
  const exists = await prisma.post.findUnique({
    where: { shortId },
    include: { media: { select: { mimeType: true } } },
  });
  if (!exists || !postHasImageMedia(exists.media)) notFound();
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <PostDetail shortId={shortId} />
    </div>
  );
}
