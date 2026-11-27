import { NextResponse } from "next/server";
import {
  ALLOWED_LAST_FRAME_MIME,
  attachShotLastFrame,
  MAX_LAST_FRAME_BYTES,
  serializeJob,
} from "@/lib/ai/video-job/service";
import { uploadRateLimitPerHour } from "@/lib/config";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getActor } from "@/lib/request-identity";
import { assertUserMayUpload } from "@/lib/user-guards";

/** Stores a client-extracted final frame for a completed video shot. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const actor = await getActor(req);
  if (!actor.userId) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const uploadBlock = await assertUserMayUpload(actor.userId);
  if (uploadBlock) return NextResponse.json({ error: uploadBlock }, { status: 403 });

  try {
    await consumeRateLimit(`upload:${actor.userId ?? actor.ipHash}`, uploadRateLimitPerHour(), 60 * 60 * 1000);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Too many uploads";
    return NextResponse.json({ error: msg }, { status: 429 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const mime = (file.type || "application/octet-stream").split(";")[0].trim().toLowerCase();
  if (!ALLOWED_LAST_FRAME_MIME.has(mime)) {
    return NextResponse.json({ error: "Unsupported frame image type" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_LAST_FRAME_BYTES) {
    return NextResponse.json({ error: "Frame image exceeds size limit" }, { status: 400 });
  }

  const rawIndex = form.get("shotIndex")?.toString();
  let shotIndex: number | undefined;
  if (rawIndex != null && rawIndex !== "") {
    const parsed = Number(rawIndex);
    if (!Number.isInteger(parsed) || parsed < 0) {
      return NextResponse.json({ error: "Invalid shot index" }, { status: 400 });
    }
    shotIndex = parsed;
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await attachShotLastFrame({ jobId: id, actor, shotIndex, buffer, mime });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true, job: serializeJob(result.job, { images: true }) });
}
