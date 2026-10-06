import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { convertImageBuffer, type ConvertFormat } from "@/lib/image-convert";
import { processAndStoreUpload } from "@/lib/media-save";
import { readLocalObject } from "@/lib/storage";

const schema = z.object({
  mediaShortId: z.string().min(4),
  format: z.enum(["jpeg", "png", "webp", "avif"]),
  quality: z.number().int().min(1).max(100).optional(),
  maxWidth: z.number().int().min(64).max(4096).optional(),
  maxHeight: z.number().int().min(64).max(4096).optional(),
});

async function loadMediaBuffer(storageKey: string, mimeType: string): Promise<Buffer> {
  const local = await readLocalObject(storageKey);
  if (local) return local;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/media/${storageKey}?mime=${encodeURIComponent(mimeType)}`);
  if (!res.ok) throw new Error("Could not load image");
  return Buffer.from(await res.arrayBuffer());
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const media = await prisma.media.findUnique({ where: { shortId: parsed.data.mediaShortId } });
  if (!media || media.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const source = await loadMediaBuffer(media.storageKey, media.mimeType);
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
      userId: session.user.id,
      voterKey: null,
      parentMediaId: parentId,
      losslessPng: parsed.data.format === "png",
    });

    return NextResponse.json({
      shortId: created.shortId,
      storageKey: created.storageKey,
      mimeType: created.mimeType,
      width: created.width,
      height: created.height,
      byteSize: created.byteSize,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Convert failed" }, { status: 400 });
  }
}
