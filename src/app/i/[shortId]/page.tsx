import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheeseSpiceGauge } from "@/components/posts/CheeseSpiceGauge";
import { ReportButton } from "@/components/report/ReportButton";
import { prisma } from "@/lib/db";
import { canViewMedia, isMediaOwner } from "@/lib/media-access";
import { recordPostView } from "@/lib/post-views";
import { buildImagePageMetadata } from "@/lib/og";
import { getServerActor } from "@/lib/request-identity";
import { imagePageUrl, mediaUrl } from "@/lib/urls";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ shortId: string }>;
}): Promise<Metadata> {
  const { shortId } = await params;
  const media = await prisma.media.findUnique({
    where: { shortId },
    include: { post: { select: { shortId: true, title: true, visibility: true, userId: true } } },
  });
  if (!media) {
    return { title: "Not found" };
  }
  return buildImagePageMetadata(media, imagePageUrl(shortId));
}

export default async function ImageDirectPage({
  params,
}: {
  params: Promise<{ shortId: string }>;
}) {
  const { shortId } = await params;
  const actor = await getServerActor();
  const media = await prisma.media.findUnique({
    where: { shortId },
    include: { post: { select: { shortId: true, title: true, visibility: true, userId: true } } },
  });
  if (!media || !canViewMedia(media, actor)) notFound();
  let postEngagement: { viewCount: number; spiceScore: number } | null = null;
  if (media.postId) {
    const postRow = await prisma.post.findUnique({
      where: { id: media.postId },
      include: { media: { select: { userId: true, voterKey: true, visibility: true } } },
    });
    if (postRow) {
      const views = await recordPostView(postRow, actor);
      postEngagement = { viewCount: views.viewCount, spiceScore: views.spiceScore };
    }
  }
  const src = mediaUrl(media.storageKey, media.mimeType);
  const canRefine = media.mimeType.startsWith("image/") && isMediaOwner(media, actor);
  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {media.post ? (
        <p className="mb-4 text-sm text-[var(--text-muted)]">
          <Link href={`/p/${media.post.shortId}`}>{media.post.title}</Link>
        </p>
      ) : (
        <p className="mb-4 text-sm text-[var(--text-muted)]">Standalone media</p>
      )}
      {media.mimeType.startsWith("video/") ? (
        <video src={src} controls className="w-full rounded-xl" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={media.altText ?? ""} className="w-full rounded-xl" />
      )}
      {postEngagement ? (
        <CheeseSpiceGauge viewCount={postEngagement.viewCount} spiceScore={postEngagement.spiceScore} />
      ) : null}
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {canRefine ? (
          <Link
            href={`/studio?tab=refine&media=${media.shortId}`}
            className="tap-target inline-flex items-center rounded-lg bg-[var(--accent-primary)] px-4 text-sm font-semibold text-[var(--on-accent)]"
          >
            Refine in studio
          </Link>
        ) : null}
        <ReportButton target={{ type: "MEDIA", id: media.id, label: "image" }} />
      </div>
    </div>
  );
}
