import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { libraryOwnerWhere, ownsLibraryRow } from "@/lib/library-access";
import { getActor } from "@/lib/request-identity";

const createSchema = z.object({
  name: z.string().min(1).max(80),
});

export async function GET(req: Request) {
  const actor = await getActor(req);
  const folders = await prisma.libraryFolder.findMany({
    where: libraryOwnerWhere(actor),
    orderBy: { createdAt: "asc" },
    select: {
      shortId: true,
      name: true,
      createdAt: true,
      _count: { select: { saves: true } },
    },
  });
  return NextResponse.json({ folders });
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });

  const owner = libraryOwnerWhere(actor);
  const folder = await prisma.libraryFolder.create({
    data: {
      shortId: newShortId(),
      name: parsed.data.name.trim(),
      ...owner,
    },
    select: { shortId: true, name: true, createdAt: true },
  });
  return NextResponse.json(folder);
}
