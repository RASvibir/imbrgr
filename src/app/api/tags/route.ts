import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: "asc" },
    take: 200,
    include: { _count: { select: { posts: true } } },
  });
  return NextResponse.json(
    tags.map((t) => ({ slug: t.slug, name: t.name, count: t._count.posts })),
  );
}
