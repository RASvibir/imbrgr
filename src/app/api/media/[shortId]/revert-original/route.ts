import { NextResponse } from "next/server";
import { getOriginalMedia, isLockedOriginal } from "@/lib/media-root";
import { prisma } from "@/lib/db";
import { isMediaOwner } from "@/lib/media-access";
import { getActor } from "@/lib/request-identity";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const media = await prisma.media.findUnique({ where: { shortId } });
  if (!media || !isMediaOwner(media, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const rootId = media.rootMediaId ?? media.id;
  const original = await getOriginalMedia(rootId);
  if (!original) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (isLockedOriginal(media)) {
    return NextResponse.json({
      shortId: original.shortId,
      storageKey: original.storageKey,
      mimeType: original.mimeType,
      width: original.width,
      height: original.height,
      alreadyOriginal: true,
    });
  }

  return NextResponse.json({
    shortId: original.shortId,
    storageKey: original.storageKey,
    mimeType: original.mimeType,
    width: original.width,
    height: original.height,
    alreadyOriginal: false,
  });
}
