import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { canViewMedia } from "@/lib/media-access";
import { getServerActor } from "@/lib/request-identity";
import { mediaUrl } from "@/lib/urls";

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
    </div>
  );
}
