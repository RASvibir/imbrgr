import { NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({ url: z.string().url() });

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }
  const res = await fetch(parsed.data.url, { redirect: "follow" });
  if (!res.ok) {
    return NextResponse.json({ error: "Could not fetch URL" }, { status: 400 });
  }
  const mime = res.headers.get("content-type")?.split(";")[0] ?? "";
  const buf = Buffer.from(await res.arrayBuffer());
  const filename = parsed.data.url.split("/").pop()?.split("?")[0] ?? "remote";
  return NextResponse.json({
    filename,
    mime,
    size: buf.byteLength,
    base64: buf.toString("base64"),
  });
}
