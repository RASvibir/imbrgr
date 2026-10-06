import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteObject } from "@/lib/storage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { shortId },
    include: {
      user: { select: { id: true, username: true } },
      media: { orderBy: { sortOrder: "asc" } },
      tags: { include: { tag: true } },
    },
  });
  if (!post) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.post.update({
    where: { id: post.id },
    data: { viewCount: { increment: 1 } },
  });
  return NextResponse.json(post);
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
  const post = await prisma.post.findUnique({ where: { shortId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const visibility = body.visibility as string | undefined;
  if (!visibility || !["PUBLIC", "UNLISTED", "HIDDEN"].includes(visibility)) {
    return NextResponse.json({ error: "Invalid visibility" }, { status: 400 });
  }
  await prisma.post.update({ where: { id: post.id }, data: { visibility } });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { shortId } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { shortId },
    include: { media: true },
  });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (post.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  for (const m of post.media) {
    await deleteObject(m.storageKey);
  }
  await prisma.post.delete({ where: { id: post.id } });
  return NextResponse.json({ ok: true });
}
