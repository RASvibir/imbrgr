import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyDeleteToken } from "@/lib/anon-delete";
import { isStorageKeySegment } from "@/lib/media-keys";
import { mediaFilePath, postUrl } from "@/lib/urls";
import { buildShareCodes } from "@/lib/embed-codes";
import { prisma } from "@/lib/db";
import { canViewMedia, isMediaOwner } from "@/lib/media-access";
import { getActor } from "@/lib/request-identity";
import { onPostRestrictedAccess, onStandaloneMediaRestricted } from "@/lib/media-access-restrict";
import { cleanupPostIfNoMedia } from "@/lib/post-cleanup";
import { deleteMediaStorage } from "@/lib/media-storage";
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
  if (isStorageKeySegment(shortId)) {
    const url = new URL(req.url);
    const target = new URL(mediaFilePath(shortId), url.origin);
    target.search = url.search;
    return NextResponse.redirect(target, 301);
  }
  const actor = await getActor(req);
  const media = await prisma.media.findUnique({
    where: { shortId },
    include: { post: { select: { title: true, userId: true, visibility: true, shortId: true } } },
  });
  if (!media || !canViewMedia(media, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const title = media.post?.title ?? "image";
  const publicPage = media.post?.shortId ? postUrl(media.post.shortId) : undefined;
  const share = buildShareCodes(media.shortId, media.storageKey, media.mimeType, title, publicPage);

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
    const vis = normalizeVisibility(parsed.data.visibility);
    await prisma.post.update({
      where: { id: media.postId },
      data: { visibility: vis },
    });
    if (vis === "PRIVATE") {
      await onPostRestrictedAccess(media.postId);
    }
  }

  if (!media.postId && parsed.data.visibility === "PRIVATE") {
    await onStandaloneMediaRestricted(media.id);
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

  await deleteMediaStorage(media);
  if (media.userId) await removeUserStorage(media.userId, media.byteSize);
  else if (media.voterKey) await removeAnonymousStorage(media.voterKey, media.byteSize);
  const postId = media.postId;
  await prisma.media.delete({ where: { id: media.id } });
  await cleanupPostIfNoMedia(postId);
  return NextResponse.json({ ok: true });
}
