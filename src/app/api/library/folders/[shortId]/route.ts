import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ownsLibraryRow } from "@/lib/library-access";
import { getActor } from "@/lib/request-identity";

const patchSchema = z.object({
  name: z.string().min(1).max(80),
});

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const folder = await prisma.libraryFolder.findUnique({ where: { shortId } });
  if (!folder || !ownsLibraryRow(folder, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  const updated = await prisma.libraryFolder.update({
    where: { id: folder.id },
    data: { name: parsed.data.name.trim() },
    select: { shortId: true, name: true },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ shortId: string }> },
) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const folder = await prisma.libraryFolder.findUnique({ where: { shortId } });
  if (!folder || !ownsLibraryRow(folder, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await prisma.librarySave.updateMany({ where: { folderId: folder.id }, data: { folderId: null } });
  await prisma.libraryFolder.delete({ where: { id: folder.id } });
  return NextResponse.json({ ok: true });
}
