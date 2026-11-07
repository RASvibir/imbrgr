import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { getActor } from "@/lib/request-identity";
import { normalizeVisibility } from "@/lib/visibility";
import { sequenceOwnerWhere } from "@/lib/shot-sequence/access";
import { defaultBeats, defaultLook } from "@/lib/shot-sequence/defaults";
import { resolveOwnedKitShortId } from "@/lib/shot-sequence/resolve-kit";
import { serializeSequence } from "@/lib/shot-sequence/serialize";
import { createSequenceSchema } from "@/lib/shot-sequence/types";

export async function GET(req: Request) {
  const actor = await getActor(req, { persist: false });
  const rows = await prisma.shotSequence.findMany({
    where: sequenceOwnerWhere(actor),
    orderBy: { updatedAt: "desc" },
    take: 48,
  });
  return NextResponse.json({
    sequences: rows.map(serializeSequence),
  });
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = createSequenceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid sequence" }, { status: 400 });
  }

  const kit = await resolveOwnedKitShortId(actor, parsed.data.kitShortId);
  if (!kit.ok) return NextResponse.json({ error: kit.error }, { status: kit.status });

  const seed = parsed.data.title;
  const beats = parsed.data.beats ?? defaultBeats(seed);
  const look = parsed.data.look ?? defaultLook(seed);
  const owner = sequenceOwnerWhere(actor);

  const row = await prisma.shotSequence.create({
    data: {
      shortId: newShortId(),
      title: parsed.data.title.trim(),
      look: look?.trim() || null,
      narration: parsed.data.narration?.trim() || null,
      aspectRatio: parsed.data.aspectRatio ?? "16:9",
      stylePreset: parsed.data.stylePreset?.trim() || null,
      kitShortId: kit.kitShortId,
      beats,
      visibility: normalizeVisibility(parsed.data.visibility ?? "PRIVATE"),
      ...owner,
    },
  });

  return NextResponse.json({ sequence: serializeSequence(row) }, { status: 201 });
}
