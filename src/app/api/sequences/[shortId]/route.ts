import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/request-identity";
import { normalizeVisibility } from "@/lib/visibility";
import { ownsSequenceRow } from "@/lib/shot-sequence/access";
import { serializeSequence } from "@/lib/shot-sequence/serialize";
import { updateSequenceSchema } from "@/lib/shot-sequence/types";

type Ctx = { params: Promise<{ shortId: string }> };

async function loadOwned(shortId: string, req: Request) {
  const actor = await getActor(req, { persist: false });
  const row = await prisma.shotSequence.findUnique({ where: { shortId } });
  if (!row || !ownsSequenceRow(row, actor)) return { actor, row: null };
  return { actor, row };
}

export async function GET(req: Request, ctx: Ctx) {
  const { shortId } = await ctx.params;
  const { row } = await loadOwned(shortId, req);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ sequence: serializeSequence(row) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const { shortId } = await ctx.params;
  const { row } = await loadOwned(shortId, req);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const parsed = updateSequenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sequence update" }, { status: 400 });
  }

  const data = parsed.data;
  const updated = await prisma.shotSequence.update({
    where: { id: row.id },
    data: {
      ...(data.title !== undefined ? { title: data.title.trim() } : {}),
      ...(data.look !== undefined ? { look: data.look?.trim() || null } : {}),
      ...(data.narration !== undefined ? { narration: data.narration?.trim() || null } : {}),
      ...(data.aspectRatio !== undefined ? { aspectRatio: data.aspectRatio } : {}),
      ...(data.stylePreset !== undefined ? { stylePreset: data.stylePreset?.trim() || null } : {}),
      ...(data.kitShortId !== undefined ? { kitShortId: data.kitShortId?.trim() || null } : {}),
      ...(data.beats !== undefined ? { beats: data.beats } : {}),
      ...(data.visibility !== undefined ? { visibility: normalizeVisibility(data.visibility) } : {}),
    },
  });

  return NextResponse.json({ sequence: serializeSequence(updated) });
}

export async function DELETE(req: Request, ctx: Ctx) {
  const { shortId } = await ctx.params;
  const { row } = await loadOwned(shortId, req);
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.shotSequence.delete({ where: { id: row.id } });
  return NextResponse.json({ ok: true });
}
