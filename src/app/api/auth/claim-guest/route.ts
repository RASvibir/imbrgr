import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { claimGuestContent } from "@/lib/claim-guest";

const VID_COOKIE = "imbrgr_vid";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }
  const jar = await cookies();
  const voterKey = jar.get(VID_COOKIE)?.value ?? "";
  if (!voterKey.startsWith("a:")) {
    return NextResponse.json({ ok: true, posts: 0, media: 0 });
  }
  const result = await claimGuestContent(session.user.id, voterKey);
  return NextResponse.json({ ok: true, ...result });
}
