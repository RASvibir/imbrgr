import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { commentInputSchema } from "@/lib/validation";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  const post = await prisma.post.findUnique({ where: { shortId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const comments = await prisma.comment.findMany({
    where: { postId: post.id },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { id: true, username: true } } },
  });
  return NextResponse.json(comments);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const session = await auth();
  const { shortId } = await ctx.params;
  const post = await prisma.post.findUnique({ where: { shortId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = commentInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid comment" }, { status: 400 });
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
