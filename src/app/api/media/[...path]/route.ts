import { NextResponse } from "next/server";
import { readLocalObject } from "@/lib/storage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await ctx.params;
  const key = segments.join("/");
  const data = await readLocalObject(key);
  if (!data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const ext = key.split(".").pop()?.toLowerCase();
  const type =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "png"
        ? "image/png"
        : ext === "gif"
          ? "image/gif"
          : ext === "webp"
            ? "image/webp"
            : ext === "mp4"
              ? "video/mp4"
              : ext === "webm"
                ? "video/webm"
                : "application/octet-stream";
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": type,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
