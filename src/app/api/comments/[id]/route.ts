import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/request-identity";

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  const actor = await getActor(req);
  const { id } = await ctx.params;

  const comment = await prisma.comment.findUnique({
    where: { id },
    include: { post: { select: { userId: true } } },
  });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let isAdmin = false;
  const currentUserId = session?.user?.id ?? actor.userId;
  if (currentUserId) {
    const user = await prisma.user.findUnique({
      where: { id: currentUserId },
      select: { role: true, banned: true },
    });
    if (user && !user.banned && (user.role === "ADMIN" || user.role === "SUPERADMIN")) {
      isAdmin = true;
    }
  }

  const isCommentAuthor = Boolean(comment.userId && currentUserId && comment.userId === currentUserId);
  const isPostAuthor = Boolean(comment.post?.userId && currentUserId && comment.post.userId === currentUserId);

  if (!isCommentAuthor && !isPostAuthor && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await prisma.comment.delete({ where: { id: comment.id } });
  return NextResponse.json({ ok: true });
}
