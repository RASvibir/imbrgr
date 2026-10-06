import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDeleteToken } from "@/lib/anon-delete";
import { buildShareCodes } from "@/lib/embed-codes";
import { prisma } from "@/lib/db";
import { canViewMedia, isMediaOwner } from "@/lib/media-access";
import { getActor } from "@/lib/request-identity";
import { deleteObject } from "@/lib/storage";
import { removeAnonymousStorage, removeUserStorage } from "@/lib/storage-quota";
import { normalizeVisibility } from "@/lib/visibility";

const patchSchema = z.object({
  altText: z.string().max(500).optional(),
  mature: z.boolean().optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
  title: z.string().max(300).optional(),
  description: z.string().max(10000).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  const actor = await getActor(req);
  const media = await prisma.media.findUnique({
    where: { shortId },
    include: { post: { select: { title: true, userId: true, visibility: true, shortId: true } } },
  });
  if (!media || !canViewMedia(media, actor)) {
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
    altText: media.altText,
    mature: media.mature,
    visibility: media.post ? media.post.visibility : media.visibility,
    aiGenerated: media.aiGenerated,
    aiEdited: media.aiEdited,
    isOwner: isMediaOwner(media, actor),
    share,
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const media = await prisma.media.findUnique({ where: { shortId }, include: { post: true } });
  if (!media || !isMediaOwner(media, actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });

  if (!media.postId && parsed.data.visibility) {
    if (!actor.userId && parsed.data.visibility === "PRIVATE") {
      return NextResponse.json({ error: "Sign in for private images" }, { status: 400 });
    }
    await prisma.media.update({
      where: { id: media.id },
      data: { visibility: normalizeVisibility(parsed.data.visibility) },
    });
  }

  await prisma.media.update({
    where: { id: media.id },
    data: {
      altText: parsed.data.altText,
      mature: parsed.data.mature,
    },
  });

  if (media.postId && parsed.data.visibility) {
    await prisma.post.update({
      where: { id: media.postId },
      data: { visibility: normalizeVisibility(parsed.data.visibility) },
    });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const media = await prisma.media.findUnique({ where: { shortId } });
  if (!media) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const token = (body as { deleteToken?: string }).deleteToken;
  const tokenOk = verifyDeleteToken(token ?? "", media.deleteTokenHash);

  if (!isMediaOwner(media, actor) && !tokenOk) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deleteObject(media.storageKey);
  if (media.userId) await removeUserStorage(media.userId, media.byteSize);
  else if (media.voterKey) await removeAnonymousStorage(media.voterKey, media.byteSize);
  await prisma.media.delete({ where: { id: media.id } });
  return NextResponse.json({ ok: true });
}
