import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canViewCollection } from "@/lib/collection-access";
import { getActor } from "@/lib/request-identity";
import { postCardSelect } from "@/lib/posts";
import { normalizeVisibility } from "@/lib/visibility";

const patchSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
});

export async function GET(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const { shortId } = await ctx.params;
  const actor = await getActor(req);
  const collection = await prisma.collection.findUnique({
    where: { shortId },
    include: {
      user: { select: { username: true, displayName: true } },
      posts: {
        orderBy: { sortOrder: "asc" },
        include: {
          post: {
            select: {
              ...postCardSelect,
              visibility: true,
              hiddenByAdmin: true,
            },
          },
        },
      },
    },
  });
  if (!collection || !canViewCollection(collection, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const isOwner = actor.userId === collection.userId;
  const visiblePosts = collection.posts
    .map((cp) => cp.post)
    .filter((p) => {
      if (p.hiddenByAdmin && !isOwner) return false;
      if (p.visibility === "PUBLIC") return true;
      return isOwner;
    });
  return NextResponse.json({ ...collection, posts: visiblePosts, isOwner });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { shortId } = await ctx.params;
  const collection = await prisma.collection.findUnique({ where: { shortId } });
  if (!collection || collection.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const updated = await prisma.collection.update({
    where: { id: collection.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      visibility: parsed.data.visibility ? normalizeVisibility(parsed.data.visibility) : undefined,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { shortId } = await ctx.params;
  const collection = await prisma.collection.findUnique({ where: { shortId } });
  if (!collection || collection.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.collection.delete({ where: { id: collection.id } });
  return NextResponse.json({ ok: true });
}
