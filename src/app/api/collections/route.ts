import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { normalizeVisibility } from "@/lib/visibility";

const createSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.collection.findMany({
    where: { userId: session.user.id },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: { _count: { select: { posts: true } } },
  });
  return NextResponse.json({ collections: rows });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const parsed = createSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid collection" }, { status: 400 });
  const row = await prisma.collection.create({
    data: {
      shortId: newShortId(),
      userId: session.user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      visibility: normalizeVisibility(parsed.data.visibility),
    },
  });
  return NextResponse.json(row);
}
