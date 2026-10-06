import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { processAndStoreUpload } from "@/lib/media-save";
import { maxBytesForMime, validateUploadMime } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });

  const mime = file.type || "application/octet-stream";
  if (!validateUploadMime(mime) || !mime.startsWith("image/")) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.byteLength > maxBytesForMime(mime)) {
    return NextResponse.json({ error: "File too large" }, { status: 400 });
  }

  try {
    const media = await processAndStoreUpload({
      buffer: buf,
      mime,
      userId: session.user.id,
      voterKey: null,
    });
    return NextResponse.json({
      shortId: media.shortId,
      storageKey: media.storageKey,
      mimeType: media.mimeType,
      width: media.width,
      height: media.height,
      byteSize: media.byteSize,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Import failed" }, { status: 400 });
  }
}
