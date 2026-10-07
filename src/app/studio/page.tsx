import { Suspense } from "react";
import { ImageStudio } from "@/components/studio/ImageStudio";
import { prisma } from "@/lib/db";
import { canViewMedia, isMediaOwner } from "@/lib/media-access";
import { getServerActor } from "@/lib/request-identity";
import { toStudioInitialAsset } from "@/lib/studio-initial-asset";

export default async function StudioPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; prompt?: string; media?: string; remixFrom?: string }>;
}) {
  const { tab, prompt, media: mediaShortId, remixFrom } = await searchParams;
  const actor = await getServerActor();

  let initialAsset = null;
  if (mediaShortId) {
    const row = await prisma.media.findUnique({
      where: { shortId: mediaShortId },
      include: { post: { select: { userId: true, visibility: true } } },
    });
    if (row && row.mimeType.startsWith("image/") && canViewMedia(row, actor) && isMediaOwner(row, actor)) {
      initialAsset = toStudioInitialAsset(row);
    }
  }

  const defaultTab = tab ?? (initialAsset ? "refine" : undefined);

  return (
    <Suspense fallback={<p className="p-8 text-center text-[var(--text-muted)]">Loading studio…</p>}>
      <ImageStudio defaultTab={defaultTab} initialPrompt={prompt} initialAsset={initialAsset} remixFromShortId={remixFrom} />
    </Suspense>
  );
}
