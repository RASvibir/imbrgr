import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildShareCodes } from "@/lib/embed-codes";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  const session = await auth();
  const media = await prisma.media.findUnique({
    where: { shortId },
    include: { post: { select: { title: true, userId: true } } },
  });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ownerId = media.userId ?? media.post?.userId;
  const isOwner = session?.user?.id === ownerId;
  if (!isOwner && media.postId == null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const title = media.post?.title ?? "image";
  const share = buildShareCodes(media.shortId, media.storageKey, media.mimeType, title);

  return NextResponse.json({
    shortId: media.shortId,
    storageKey: media.storageKey,
    mimeType: media.mimeType,
    width: media.width,
    height: media.height,
    byteSize: media.byteSize,
    aiGenerated: media.aiGenerated,
    aiEdited: media.aiEdited,
    isOwner,
    share,
  });
}
