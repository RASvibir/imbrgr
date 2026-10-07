import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { canViewPost } from "@/lib/media-access";
import { newShortId } from "@/lib/ids";
import { processAndStoreUpload } from "@/lib/media-save";
import { getActor } from "@/lib/request-identity";
import { readLocalObject, readObject } from "@/lib/storage";
import { postUrl, siteUrl } from "@/lib/urls";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  const actor = await getActor(req);
  const post = await prisma.post.findUnique({
    where: { shortId },
    include: { media: { orderBy: { sortOrder: "asc" }, take: 1 } },
  });
  if (!post || post.visibility !== "PUBLIC" || post.hiddenByAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canViewPost(post, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (post.aiGenerated && post.aiPrompt) {
    const q = new URLSearchParams({
      tab: "generate",
      prompt: post.aiPrompt,
      remixFrom: post.shortId,
    });
    return NextResponse.json({
      mode: "studio",
      url: `/studio?${q}`,
      sourceTitle: post.title,
    });
  }

  const sourceMedia = post.media[0];
  if (!sourceMedia?.mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "Only images can be remixed this way" }, { status: 400 });
  }

  const bytes = (await readObject(sourceMedia.storageKey)) ?? (await readLocalObject(sourceMedia.storageKey));
  if (!bytes) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const newPost = await prisma.post.create({
    data: {
      shortId: newShortId(),
      userId: actor.userId,
      title: `Remix of ${post.title}`.slice(0, 300),
      visibility: "UNLISTED",
      remixedFromPostId: post.id,
    },
  });

  await processAndStoreUpload({
    buffer: bytes,
    mime: sourceMedia.mimeType,
    userId: actor.userId,
    voterKey: actor.userId ? null : actor.voterKey,
    postId: newPost.id,
    sortOrder: 0,
    visibility: "UNLISTED",
    parentMediaId: sourceMedia.id,
  });

  const refineQ = new URLSearchParams({ tab: "refine", remixFrom: post.shortId });
  const media = await prisma.media.findFirst({ where: { postId: newPost.id } });
  if (media) refineQ.set("media", media.shortId);

  return NextResponse.json({
    mode: "refine",
    postShortId: newPost.shortId,
    url: `/studio?${refineQ}`,
    sourceUrl: siteUrl(postUrl(post.shortId)),
    sourceTitle: post.title,
  });
}
