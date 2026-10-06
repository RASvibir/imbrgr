import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const { shortId } = await ctx.params;
  const post = await prisma.post.findUnique({ where: { shortId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const existing = await prisma.favorite.findUnique({
    where: { userId_postId: { userId: session.user.id, postId: post.id } },
  });
  if (existing) {
    await prisma.favorite.delete({
      where: { userId_postId: { userId: session.user.id, postId: post.id } },
    });
    return NextResponse.json({ favorited: false });
  }
  await prisma.favorite.create({
    data: { userId: session.user.id, postId: post.id },
  });
  return NextResponse.json({ favorited: true });
}
