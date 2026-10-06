import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { convertImageBuffer, type ConvertFormat } from "@/lib/image-convert";
import { isMediaOwner } from "@/lib/media-access";
import { processAndStoreUpload } from "@/lib/media-save";
import { getActor } from "@/lib/request-identity";
import { consumeRateLimit } from "@/lib/rate-limit";
import { uploadRateLimitPerHour } from "@/lib/config";
import { readObject } from "@/lib/storage";
import { normalizeVisibility } from "@/lib/visibility";

const schema = z.object({
  mediaShortId: z.string().min(4),
  format: z.enum(["jpeg", "png", "webp", "avif"]),
  quality: z.number().int().min(1).max(100).optional(),
  maxWidth: z.number().int().min(64).max(4096).optional(),
  maxHeight: z.number().int().min(64).max(4096).optional(),
});

export async function POST(req: Request) {
  const actor = await getActor(req);
  await consumeRateLimit(`upload:${actor.userId ?? actor.ipHash}`, uploadRateLimitPerHour(), 60 * 60 * 1000);

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const media = await prisma.media.findUnique({ where: { shortId: parsed.data.mediaShortId } });
  if (!media || !isMediaOwner(media, actor)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const source = await readObject(media.storageKey);
    if (!source) throw new Error("Could not load image");

    const converted = await convertImageBuffer(source, {
      format: parsed.data.format as ConvertFormat,
      quality: parsed.data.quality,
      maxWidth: parsed.data.maxWidth,
      maxHeight: parsed.data.maxHeight,
    });

    const parentId = media.parentMediaId ?? media.id;
    const created = await processAndStoreUpload({
      buffer: converted.buffer,
      mime: converted.mime,
      userId: actor.userId,
      voterKey: actor.userId ? null : actor.voterKey,
      parentMediaId: parentId,
      visibility: normalizeVisibility(media.visibility),
      losslessPng: parsed.data.format === "png",
    });

    return NextResponse.json({
      shortId: created.shortId,
      storageKey: created.storageKey,
      mimeType: created.mimeType,
      width: created.width,
      height: created.height,
      byteSize: created.byteSize,
      deleteToken: created.deleteToken,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Convert failed" }, { status: 400 });
  }
}
