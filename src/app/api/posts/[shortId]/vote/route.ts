import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getVoterKey } from "@/lib/voter";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const value = body.value === -1 ? -1 : 1;
  const post = await prisma.post.findUnique({ where: { shortId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { userId, voterKey } = await getVoterKey();
  const existing = await prisma.postVote.findUnique({
    where: { postId_voterKey: { postId: post.id, voterKey } },
  });

  let upDelta = 0;
  let downDelta = 0;
  let scoreDelta = 0;

  if (!existing) {
    await prisma.postVote.create({
      data: { postId: post.id, userId, voterKey, value },
    });
    if (value === 1) {
      upDelta = 1;
      scoreDelta = 1;
    } else {
      downDelta = 1;
      scoreDelta = -1;
    }
  } else if (existing.value === value) {
    await prisma.postVote.delete({ where: { id: existing.id } });
    if (value === 1) {
      upDelta = -1;
      scoreDelta = -1;
    } else {
      downDelta = -1;
      scoreDelta = 1;
    }
  } else {
    await prisma.postVote.update({ where: { id: existing.id }, data: { value } });
    if (value === 1) {
      upDelta = 1;
      downDelta = -1;
      scoreDelta = 2;
    } else {
      upDelta = -1;
      downDelta = 1;
      scoreDelta = -2;
    }
  }

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: {
      upvoteCount: { increment: upDelta },
      downvoteCount: { increment: downDelta },
      score: { increment: scoreDelta },
    },
  });

  return NextResponse.json({
    score: updated.score,
    upvoteCount: updated.upvoteCount,
    downvoteCount: updated.downvoteCount,
  });
}
