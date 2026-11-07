import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { kitOwnerWhere, ownsKitRow } from "@/lib/kit-access";
import { parseKitPalette } from "@/lib/kit-prompt";
import { kitMediaSelect, serializeKit } from "@/lib/kit-serialize";
import { isMediaOwner } from "@/lib/media-access";
import { getActor } from "@/lib/request-identity";

const updateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  description: z.string().max(2000).nullable().optional(),
  styleLock: z.string().max(2000).nullable().optional(),
  palette: z
    .object({
      primary: z.string().max(16).optional(),
      secondary: z.string().max(16).optional(),
      accents: z.array(z.string().max(16)).max(6).optional(),
    })
    .nullable()
    .optional(),
  stylePreset: z.string().max(40).nullable().optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
  coverMediaShortId: z.string().min(4).nullable().optional(),
});

async function loadOwnedKit(shortId: string, actor: Awaited<ReturnType<typeof getActor>>) {
  const kit = await prisma.characterKit.findUnique({
    where: { shortId },
    include: {
      coverMedia: { select: kitMediaSelect },
      refs: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { media: { select: kitMediaSelect } },
      },
      _count: { select: { refs: true } },
    },
  });
  if (!kit || !ownsKitRow(kit, actor)) return null;
  return kit;
}

export async function GET(req: Request, ctx: { params: Promise<{ shortId: string }> }) {
  const actor = await getActor(req, { persist: false });
  const { shortId } = await ctx.params;
  const kit = await loadOwnedKit(shortId, actor);
  if (!kit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ kit: serializeKit(kit) });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ shortId: string }> }) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const existing = await prisma.characterKit.findUnique({ where: { shortId } });
  if (!existing || !ownsKitRow(existing, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid update" }, { status: 400 });

  let coverMediaId: string | null | undefined;
  if (parsed.data.coverMediaShortId === null) {
    coverMediaId = null;
  } else if (parsed.data.coverMediaShortId) {
    const media = await prisma.media.findUnique({ where: { shortId: parsed.data.coverMediaShortId } });
    if (!media || !isMediaOwner(media, actor)) {
      return NextResponse.json({ error: "Cover media not found" }, { status: 404 });
    }
    coverMediaId = media.id;
  }

  const data: Prisma.CharacterKitUncheckedUpdateInput = {};

  if (parsed.data.name !== undefined) data.name = parsed.data.name.trim();
  if (parsed.data.description !== undefined) data.description = parsed.data.description?.trim() || null;
  if (parsed.data.styleLock !== undefined) data.styleLock = parsed.data.styleLock?.trim() || null;
  if (parsed.data.stylePreset !== undefined) data.stylePreset = parsed.data.stylePreset?.trim() || null;
  if (parsed.data.visibility !== undefined) data.visibility = parsed.data.visibility;
  if (parsed.data.palette !== undefined) {
    const palette = parsed.data.palette === null ? null : parseKitPalette(parsed.data.palette);
    data.paletteJson =
      palette === null ? Prisma.JsonNull : (palette as Prisma.InputJsonValue);
  }
  if (coverMediaId !== undefined) data.coverMediaId = coverMediaId;

  const kit = await prisma.characterKit.update({
    where: { id: existing.id },
    data,
    include: {
      coverMedia: { select: kitMediaSelect },
      refs: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { media: { select: kitMediaSelect } },
      },
      _count: { select: { refs: true } },
    },
  });

  return NextResponse.json({ kit: serializeKit(kit) });
}

export async function DELETE(req: Request, ctx: { params: Promise<{ shortId: string }> }) {
  const actor = await getActor(req);
  const { shortId } = await ctx.params;
  const existing = await prisma.characterKit.findFirst({
    where: { shortId, ...kitOwnerWhere(actor) },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.characterKit.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
