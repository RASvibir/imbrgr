import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getVoterKey } from "@/lib/voter";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const value = body.value === -1 ? -1 : 1;
  const comment = await prisma.comment.findUnique({ where: { id } });
  if (!comment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { userId, voterKey } = await getVoterKey();
  const existing = await prisma.commentVote.findUnique({
    where: { commentId_voterKey: { commentId: comment.id, voterKey } },
  });

  let scoreDelta = 0;
  if (!existing) {
    await prisma.commentVote.create({
      data: { commentId: comment.id, userId, voterKey, value },
    });
    scoreDelta = value;
  } else if (existing.value === value) {
    await prisma.commentVote.delete({ where: { id: existing.id } });
    scoreDelta = -value;
  } else {
    await prisma.commentVote.update({ where: { id: existing.id }, data: { value } });
    scoreDelta = value * 2;
  }

  const updated = await prisma.comment.update({
    where: { id: comment.id },
    data: { score: { increment: scoreDelta } },
  });
  return NextResponse.json({ score: updated.score });
}
