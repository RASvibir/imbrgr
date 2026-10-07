import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAddPostToCollection } from "@/lib/collection-access";
import { getActor } from "@/lib/request-identity";

const schema = z.object({
  postShortId: z.string(),
  action: z.enum(["add", "remove"]),
});

export async function POST(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { shortId } = await ctx.params;
  const actor = await getActor(req);
  const collection = await prisma.collection.findUnique({ where: { shortId } });
  if (!collection) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });

  const post = await prisma.post.findUnique({ where: { shortId: parsed.data.postShortId } });
  if (!post) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!canAddPostToCollection(collection, post, actor)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.action === "add") {
    await prisma.collectionPost.upsert({
      where: { collectionId_postId: { collectionId: collection.id, postId: post.id } },
      create: { collectionId: collection.id, postId: post.id },
      update: {},
    });
    await prisma.collection.update({
      where: { id: collection.id },
      data: { coverPostId: collection.coverPostId ?? post.id },
    });
  } else {
    await prisma.collectionPost.deleteMany({
      where: { collectionId: collection.id, postId: post.id },
    });
  }
  return NextResponse.json({ ok: true });
}
