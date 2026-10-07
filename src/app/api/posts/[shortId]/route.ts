import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canDeletePost, deletePostAndMedia, isGuestPostOwner } from "@/lib/post-cleanup";
import { postHasImageMedia } from "@/lib/post-feed-filter";
import { canViewPost, isMediaOwner, isPostOwner } from "@/lib/media-access";
import { getActor } from "@/lib/request-identity";
import { slugifyTag } from "@/lib/validation";
import { recordPostView } from "@/lib/post-views";
import { onPostRestrictedAccess } from "@/lib/media-access-restrict";
import { normalizeVisibility } from "@/lib/visibility";

const patchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  description: z.string().max(10000).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE", "HIDDEN"]).optional(),
  tags: z.array(z.string()).max(20).optional(),
  media: z
    .array(
      z.object({
        shortId: z.string(),
        altText: z.string().max(500).optional(),
        mature: z.boolean().optional(),
      }),
    )
    .optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  const actor = await getActor(req);
  const post = await prisma.post.findUnique({
    where: { shortId },
    include: {
      user: {
        select: { id: true, username: true, displayName: true, avatarKey: true },
      },
      media: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
      remixedFrom: { select: { shortId: true, title: true } },
    },
  });
  if (!post || !canViewPost(post, actor) || !postHasImageMedia(post.media)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const views = await recordPostView(post, actor);
  const postLike = { userId: post.userId, visibility: post.visibility };
  const canManage = isPostOwner(postLike, actor) || isGuestPostOwner(post, post.media, actor);
  return NextResponse.json({
    ...post,
    viewCount: views.viewCount,
    spiceScore: views.spiceScore ?? post.spiceScore ?? 0,
    canManage,
    canDelete: canDeletePost(post, post.media, actor),
    // Never expose guest identity keys or delete-token hashes on the public post payload.
    media: post.media.map((m) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { voterKey: _voterKey, deleteTokenHash: _deleteTokenHash, ...publicMedia } = m;
      return {
        ...publicMedia,
        canRefine: m.mimeType.startsWith("image/") && isMediaOwner(m, actor),
      };
    }),
  });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { shortId } = await ctx.params;
  const post = await prisma.post.findUnique({ where: { shortId }, include: { media: true } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid settings" }, { status: 400 });

  const visibility = parsed.data.visibility
    ? normalizeVisibility(parsed.data.visibility)
    : undefined;

  await prisma.post.update({
    where: { id: post.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      visibility,
    },
  });

  if (visibility === "PRIVATE") {
    await onPostRestrictedAccess(post.id);
  }

  if (parsed.data.tags) {
    const tagRows = await Promise.all(
      parsed.data.tags.map(async (name) => {
        const slug = slugifyTag(name);
        return prisma.tag.upsert({
          where: { slug },
          create: { slug, name },
          update: {},
        });
      }),
    );
    await prisma.postTag.deleteMany({ where: { postId: post.id } });
    if (tagRows.length) {
      await prisma.postTag.createMany({
        data: tagRows.map((t) => ({ postId: post.id, tagId: t.id })),
        skipDuplicates: true,
      });
    }
  }

  if (parsed.data.media?.length) {
    for (const m of parsed.data.media) {
      const row = post.media.find((x) => x.shortId === m.shortId);
      if (!row) continue;
      await prisma.media.update({
        where: { id: row.id },
        data: { altText: m.altText, mature: m.mature },
      });
    }
  }

  const updated = await prisma.post.findUnique({
    where: { id: post.id },
    include: {
      user: { select: { id: true, username: true, displayName: true, avatarKey: true } },
      media: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { shortId },
    include: { media: true },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const deleteToken = (body as { deleteToken?: string }).deleteToken;
  if (!canDeletePost(post, post.media, actor, deleteToken)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await deletePostAndMedia(post.id);
  return NextResponse.json({ ok: true });
}
