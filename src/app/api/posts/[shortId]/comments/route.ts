import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commentInputSchema } from "@/lib/validation";
import { canViewPost } from "@/lib/media-access";
import { getActor } from "@/lib/request-identity";
import { assertUserMayComment } from "@/lib/user-guards";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isPromptBlocked, blockedPromptMessage } from "@/lib/prompt-safety";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { shortId },
    include: { media: true },
  });
  if (!post || !canViewPost(post, actor) || post.hiddenByAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const comments = await prisma.comment.findMany({
    where: { postId: post.id },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { user: { select: { id: true, username: true } } },
  });
  return NextResponse.json(comments);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const session = await auth();
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { shortId },
    include: { media: true },
  });
  if (!post || !canViewPost(post, actor) || post.hiddenByAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const userBlock = await assertUserMayComment(session?.user?.id ?? null);
  if (userBlock) {
    return NextResponse.json({ error: userBlock }, { status: 403 });
  }

  try {
    await consumeRateLimit(`comment:${actor.userId ?? actor.ipHash}`, 30, 60 * 1000);
  } catch {
    return NextResponse.json({ error: "Slow down — you're posting comments too fast." }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = commentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
  }

  if (isPromptBlocked(parsed.data.body)) {
    return NextResponse.json({ error: blockedPromptMessage }, { status: 400 });
  }

  if (parsed.data.parentId) {
    const parent = await prisma.comment.findUnique({
      where: { id: parsed.data.parentId },
      select: { id: true, postId: true },
    });
    if (!parent || parent.postId !== post.id) {
      return NextResponse.json({ error: "Invalid parent comment for this post" }, { status: 400 });
    }
  }

  const comment = await prisma.comment.create({
    data: {
      postId: post.id,
      userId: session?.user?.id ?? null,
      parentId: parsed.data.parentId,
      body: parsed.data.body,
    },
    include: { user: { select: { id: true, username: true } } },
  });
  return NextResponse.json(comment);
}

