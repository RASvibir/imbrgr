import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { storeUserProfileImage } from "@/lib/media-save";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file required" }, { status: 400 });
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    const result = await storeUserProfileImage({
      userId: session.user.id,
      kind: "avatar",
      buffer: buf,
      mime: file.type || "image/jpeg",
    });
    return NextResponse.json({ avatarKey: result.storageKey });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 400 });
  }
}
