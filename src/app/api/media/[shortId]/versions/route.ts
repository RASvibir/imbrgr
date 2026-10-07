import { NextResponse } from "next/server";
import { isLockedOriginal, listMediaVersionFamily } from "@/lib/media-root";
import { prisma } from "@/lib/db";
import { canViewMedia, isMediaOwner } from "@/lib/media-access";
import { getActor } from "@/lib/request-identity";
import { mediaUrl } from "@/lib/urls";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const media = await prisma.media.findUnique({
    where: { shortId },
    include: { post: { select: { userId: true, visibility: true } } },
  });
  if (!media || !canViewMedia(media, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rootId = media.rootMediaId ?? media.id;
  const versions = await listMediaVersionFamily(rootId);
  const isOwner = isMediaOwner(media, actor);

  return NextResponse.json({
    rootMediaId: rootId,
    isOwner,
    versions: versions.map((v) => ({
      shortId: v.shortId,
      storageKey: v.storageKey,
      mimeType: v.mimeType,
      width: v.width,
      height: v.height,
      locked: isLockedOriginal(v),
      previewUrl: mediaUrl(v.storageKey, v.mimeType),
      aiEdited: v.aiEdited,
      aiGenerated: v.aiGenerated,
      isCurrent: v.shortId === shortId,
    })),
  });
}
