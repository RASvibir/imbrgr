import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { kitOwnerWhere } from "@/lib/kit-access";
import { parseKitPalette } from "@/lib/kit-prompt";
import { kitMediaSelect, serializeKit } from "@/lib/kit-serialize";
import { getActor } from "@/lib/request-identity";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  styleLock: z.string().max(2000).optional(),
  palette: z
    .object({
      primary: z.string().max(16).optional(),
      secondary: z.string().max(16).optional(),
      accents: z.array(z.string().max(16)).max(6).optional(),
    })
    .optional(),
  stylePreset: z.string().max(40).optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
});

export async function GET(req: Request) {
  const actor = await getActor(req, { persist: false });
  const kits = await prisma.characterKit.findMany({
    where: kitOwnerWhere(actor),
    orderBy: { updatedAt: "desc" },
    take: 64,
    include: {
      coverMedia: { select: kitMediaSelect },
      _count: { select: { refs: true } },
    },
  });
  return NextResponse.json({ kits: kits.map(serializeKit) });
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid kit" }, { status: 400 });
  }

  const palette = parseKitPalette(parsed.data.palette ?? null);
  const owner = kitOwnerWhere(actor);
  const kit = await prisma.characterKit.create({
    data: {
      shortId: newShortId(),
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      styleLock: parsed.data.styleLock?.trim() || null,
      paletteJson: (palette ?? undefined) as Prisma.InputJsonValue | undefined,
      stylePreset: parsed.data.stylePreset?.trim() || null,
      visibility: parsed.data.visibility ?? "PRIVATE",
      ...owner,
    },
    include: {
      coverMedia: { select: kitMediaSelect },
      _count: { select: { refs: true } },
    },
  });

  return NextResponse.json({ kit: serializeKit(kit) }, { status: 201 });
}
