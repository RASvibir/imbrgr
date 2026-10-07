import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canViewMedia, isMediaOwner } from "@/lib/media-access";
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
      {canRefine ? (
        <div className="mt-4">
          <Link
            href={`/studio?tab=refine&media=${media.shortId}`}
            className="inline-flex rounded-lg bg-[var(--accent-primary)] px-4 py-2 text-sm font-semibold text-[var(--on-accent)]"
          >
            Refine in studio
          </Link>
        </div>
      ) : null}
    </div>
  );
}
