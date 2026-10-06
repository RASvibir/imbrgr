import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { autoEnhanceBuffer } from "@/lib/image-convert";
import { isMediaOwner } from "@/lib/media-access";
import { processAndStoreUpload } from "@/lib/media-save";
import { getActor } from "@/lib/request-identity";
import { readObject } from "@/lib/storage";
import { normalizeVisibility } from "@/lib/visibility";

const schema = z.object({ mediaShortId: z.string().min(4) });

export async function POST(req: Request) {
  const actor = await getActor(req);
  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const media = await prisma.media.findUnique({ where: { shortId: parsed.data.mediaShortId } });
  if (!media || !isMediaOwner(media, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const source = await readObject(media.storageKey);
  if (!source) return NextResponse.json({ error: "Could not load image" }, { status: 400 });

  try {
    const enhanced = await autoEnhanceBuffer(source);
    const parentId = media.parentMediaId ?? media.id;
    const created = await processAndStoreUpload({
      buffer: enhanced,
      mime: "image/jpeg",
      userId: actor.userId,
      voterKey: actor.userId ? null : actor.voterKey,
      parentMediaId: parentId,
      visibility: normalizeVisibility(media.visibility),
    });
    return NextResponse.json({
      shortId: created.shortId,
      storageKey: created.storageKey,
      mimeType: created.mimeType,
      deleteToken: created.deleteToken,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enhance failed" }, { status: 400 });
  }
}
