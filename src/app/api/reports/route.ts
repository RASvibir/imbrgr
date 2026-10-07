import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/request-identity";
import { consumeRateLimit } from "@/lib/rate-limit";
import { z } from "zod";

const schema = z.object({
  targetType: z.enum(["POST", "MEDIA", "COLLECTION", "USER"]),
  targetId: z.string().min(1),
  reason: z.string().min(3).max(500),
  postShortId: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  const actor = await getActor(req);
  try {
    await consumeRateLimit(`report:${actor.voterKey}`, 12, 60 * 60 * 1000);
  } catch {
    return NextResponse.json({ error: "Slow down — try again in a bit." }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }

  let postId: string | null = null;
  if (parsed.data.targetType === "POST") {
    const post = await prisma.post.findFirst({
      where: { OR: [{ id: parsed.data.targetId }, { shortId: parsed.data.targetId }] },
    });
    if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
    postId = post.id;
    parsed.data.targetId = post.id;
  } else if (parsed.data.postShortId) {
    const post = await prisma.post.findUnique({ where: { shortId: parsed.data.postShortId } });
    postId = post?.id ?? null;
  }

  const existing = await prisma.report.findFirst({
    where: {
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      voterKey: actor.voterKey,
      status: "OPEN",
    },
  });
  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await prisma.report.create({
    data: {
      targetType: parsed.data.targetType,
      targetId: parsed.data.targetId,
      postId,
      userId: session?.user?.id ?? null,
      voterKey: actor.voterKey,
      reason: parsed.data.reason,
    },
  });
  return NextResponse.json({ ok: true });
}
