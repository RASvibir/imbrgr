import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { autoEnhanceBuffer } from "@/lib/image-convert";
import { processAndStoreUpload } from "@/lib/media-save";
import { readLocalObject } from "@/lib/storage";

const schema = z.object({ mediaShortId: z.string().min(4) });

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

  let source = await readLocalObject(media.storageKey);
  if (!source) {
    const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
    const res = await fetch(`${base}/api/media/${media.storageKey}?mime=${encodeURIComponent(media.mimeType)}`);
    if (!res.ok) return NextResponse.json({ error: "Could not load image" }, { status: 400 });
    source = Buffer.from(await res.arrayBuffer());
  }

  try {
    const enhanced = await autoEnhanceBuffer(source);
    const parentId = media.parentMediaId ?? media.id;
    const created = await processAndStoreUpload({
      buffer: enhanced,
      mime: "image/jpeg",
      userId: session.user.id,
      voterKey: null,
      parentMediaId: parentId,
    });
    return NextResponse.json({
      shortId: created.shortId,
      storageKey: created.storageKey,
      mimeType: created.mimeType,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Enhance failed" }, { status: 400 });
  }
}
