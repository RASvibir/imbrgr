import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ownsKitRow } from "@/lib/kit-access";
import { KIT_REF_ROLES, parseKitRefRole } from "@/lib/kit-prompt";
import { kitMediaSelect, serializeKit } from "@/lib/kit-serialize";
import { isMediaOwner } from "@/lib/media-access";
import { getActor } from "@/lib/request-identity";

const addSchema = z.object({
  mediaShortId: z.string().min(4),
  role: z.enum(KIT_REF_ROLES).optional(),
  note: z.string().max(200).optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});

const removeSchema = z.object({
  mediaShortId: z.string().min(4),
});

async function loadKitDetail(kitId: string) {
  return prisma.characterKit.findUniqueOrThrow({
    where: { id: kitId },
    include: {
      coverMedia: { select: kitMediaSelect },
      refs: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { media: { select: kitMediaSelect } },
      },
      _count: { select: { refs: true } },
    },
  });
}

export async function POST(req: Request, ctx: { params: Promise<{ shortId: string }> }) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const kit = await prisma.characterKit.findUnique({ where: { shortId } });
  if (!kit || !ownsKitRow(kit, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid ref" }, { status: 400 });

  const media = await prisma.media.findUnique({ where: { shortId: parsed.data.mediaShortId } });
  if (!media || !isMediaOwner(media, actor)) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const role = parseKitRefRole(parsed.data.role);
  const existing = await prisma.characterKitRef.findUnique({
    where: { kitId_mediaId: { kitId: kit.id, mediaId: media.id } },
  });

  if (existing) {
    await prisma.characterKitRef.update({
      where: { id: existing.id },
      data: {
        role,
        note: parsed.data.note?.trim() || existing.note,
        sortOrder: parsed.data.sortOrder ?? existing.sortOrder,
      },
    });
  } else {
    const count = await prisma.characterKitRef.count({ where: { kitId: kit.id } });
    await prisma.characterKitRef.create({
      data: {
        kitId: kit.id,
        mediaId: media.id,
        role,
        note: parsed.data.note?.trim() || null,
        sortOrder: parsed.data.sortOrder ?? count,
      },
    });
  }

  if (!kit.coverMediaId) {
    await prisma.characterKit.update({
      where: { id: kit.id },
      data: { coverMediaId: media.id },
    });
  }

  const detail = await loadKitDetail(kit.id);
  return NextResponse.json({ kit: serializeKit(detail) });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ shortId: string }> }) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const kit = await prisma.characterKit.findUnique({ where: { shortId } });
  if (!kit || !ownsKitRow(kit, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = removeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const media = await prisma.media.findUnique({ where: { shortId: parsed.data.mediaShortId } });
  if (!media) return NextResponse.json({ error: "Media not found" }, { status: 404 });

  await prisma.characterKitRef.deleteMany({
    where: { kitId: kit.id, mediaId: media.id },
  });

  if (kit.coverMediaId === media.id) {
    const nextCover = await prisma.characterKitRef.findFirst({
      where: { kitId: kit.id },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    await prisma.characterKit.update({
      where: { id: kit.id },
      data: { coverMediaId: nextCover?.mediaId ?? null },
    });
  }

  const detail = await loadKitDetail(kit.id);
  return NextResponse.json({ kit: serializeKit(detail) });
}
