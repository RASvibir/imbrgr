import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { postCardSelect } from "@/lib/posts";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ username: string }> },
) {
  const { username } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      username: true,
      createdAt: true,
      posts: {
        where: { visibility: "PUBLIC" },
        orderBy: { createdAt: "desc" },
        take: 48,
        select: postCardSelect,
      },
      favorites: {
        orderBy: { createdAt: "desc" },
        take: 48,
        include: { post: { select: postCardSelect } },
      },
      comments: {
        orderBy: { createdAt: "desc" },
        take: 48,
        include: {
          post: { select: { shortId: true, title: true } },
        },
      },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(user);
}
