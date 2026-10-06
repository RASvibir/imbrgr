import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  postShortId: z.string().min(4),
  reason: z.string().min(3).max(500),
});

export async function POST(req: Request) {
  const session = await auth();
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid report" }, { status: 400 });
  }
  const post = await prisma.post.findUnique({ where: { shortId: parsed.data.postShortId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.report.create({
    data: {
      postId: post.id,
      userId: session?.user?.id ?? null,
      reason: parsed.data.reason,
    },
  });
  return NextResponse.json({ ok: true });
}
