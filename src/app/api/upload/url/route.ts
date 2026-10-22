import { NextResponse } from "next/server";
import { z } from "zod";
import { uploadRateLimitPerHour } from "@/lib/config";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getActor } from "@/lib/request-identity";
import { fetchRemoteFile, RemoteFetchError } from "@/lib/safe-remote-fetch";
import { maxBytesForMime, validateUploadMime } from "@/lib/validation";

const schema = z.object({ url: z.string().url().max(2048) });

export async function POST(req: Request) {
  const actor = await getActor(req);
  try {
    await consumeRateLimit(`upload-url:${actor.userId ?? actor.ipHash}`, uploadRateLimitPerHour(), 60 * 60 * 1000);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Too many requests" }, { status: 429 });
  }

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const file = await fetchRemoteFile(parsed.data.url, {
      allowMime: validateUploadMime,
      maxBytesFor: maxBytesForMime,
    });
    return NextResponse.json({
      filename: file.filename,
      mime: file.mime,
      size: file.buffer.byteLength,
      base64: file.buffer.toString("base64"),
    });
  } catch (e) {
    if (e instanceof RemoteFetchError) {
      return NextResponse.json({ error: e.message }, { status: e.status });
    }
    return NextResponse.json({ error: "Could not fetch URL" }, { status: 400 });
  }
}
