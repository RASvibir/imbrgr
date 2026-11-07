import { NextResponse } from "next/server";
import { z } from "zod";
import { VIDEO_STYLES } from "@/lib/ai/video-provider";
import { prisma } from "@/lib/db";
import { getActor } from "@/lib/request-identity";
import { ownsSequenceRow } from "@/lib/shot-sequence/access";
import { exportSequence } from "@/lib/shot-sequence/export";
import { kitPromptForSequence } from "@/lib/shot-sequence/resolve-kit";
import { resolveSequenceVideoStyleId } from "@/lib/shot-sequence/resolve-video-style";
import { parseBeats } from "@/lib/shot-sequence/serialize";
import { exportFormatSchema } from "@/lib/shot-sequence/types";

type Ctx = { params: Promise<{ shortId: string }> };

const bodySchema = z.object({
  format: exportFormatSchema.default("storyboard"),
});

export async function POST(req: Request, ctx: Ctx) {
  const { shortId } = await ctx.params;
  const actor = await getActor(req, { persist: false });
  const row = await prisma.shotSequence.findUnique({ where: { shortId } });
  if (!row || !ownsSequenceRow(row, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid export request" }, { status: 400 });
  }

  const kit = await kitPromptForSequence(row.kitShortId);
  const styleId = resolveSequenceVideoStyleId(row.stylePreset, kit.stylePreset);
  const style = VIDEO_STYLES.find((s) => s.id === styleId);
  const payload = exportSequence(
    {
      shortId: row.shortId,
      title: row.title,
      look: row.look,
      narration: row.narration,
      aspectRatio: row.aspectRatio,
      stylePreset: styleId,
      kitShortId: row.kitShortId,
      beats: parseBeats(row.beats),
      kitFragment: kit.fragment || null,
      stylePresetSuffix: style?.promptSuffix ?? null,
    },
    parsed.data.format,
  );

  return NextResponse.json({ export: payload });
}
