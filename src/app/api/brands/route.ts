import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { newShortId } from "@/lib/ids";
import { brandOwnerWhere } from "@/lib/brand-access";
import { parseKitPalette } from "@/lib/kit-prompt";
import { LOGO_SAFE_ZONES, parseLogoSafeZone } from "@/lib/brand-prompt";
import { brandMediaSelect, serializeBrandKit } from "@/lib/brand-serialize";
import { getActor } from "@/lib/request-identity";
import type { Prisma } from "@/generated/prisma/client";

const createSchema = z.object({
  name: z.string().min(1).max(80),
  description: z.string().max(2000).optional(),
  styleLock: z.string().max(2000).optional(),
  typographyLock: z.string().max(2000).optional(),
  palette: z
    .object({
      primary: z.string().max(16).optional(),
      secondary: z.string().max(16).optional(),
      accents: z.array(z.string().max(16)).max(6).optional(),
    })
    .optional(),
  stylePreset: z.string().max(40).optional(),
  logoSafeZone: z.enum(LOGO_SAFE_ZONES).optional(),
  visibility: z.enum(["PRIVATE", "UNLISTED", "PUBLIC"]).optional(),
});

export async function GET(req: Request) {
  const actor = await getActor(req, { persist: false });
  const brands = await prisma.brandKit.findMany({
    where: brandOwnerWhere(actor),
    orderBy: { updatedAt: "desc" },
    take: 64,
    include: {
      logoMedia: { select: brandMediaSelect },
    },
  });
  return NextResponse.json({ brands: brands.map(serializeBrandKit) });
}

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid brand kit" }, { status: 400 });
  }

  const palette = parseKitPalette(parsed.data.palette ?? null);
  const owner = brandOwnerWhere(actor);
  const brand = await prisma.brandKit.create({
    data: {
      shortId: newShortId(),
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() || null,
      styleLock: parsed.data.styleLock?.trim() || null,
      typographyLock: parsed.data.typographyLock?.trim() || null,
      paletteJson: (palette ?? undefined) as Prisma.InputJsonValue | undefined,
      stylePreset: parsed.data.stylePreset?.trim() || null,
      logoSafeZone: parseLogoSafeZone(parsed.data.logoSafeZone),
      visibility: parsed.data.visibility ?? "PRIVATE",
      ...owner,
    },
    include: {
      logoMedia: { select: brandMediaSelect },
    },
  });

  return NextResponse.json({ brand: serializeBrandKit(brand) }, { status: 201 });
}
