import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

const COOKIE = "imbrgr_vid";

export async function getVoterKey(): Promise<{ userId: string | null; voterKey: string }> {
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, voterKey: `u:${session.user.id}` };
  }
  const jar = await cookies();
  let vid = jar.get(COOKIE)?.value;
  if (!vid) {
    vid = `a:${crypto.randomUUID()}`;
    jar.set(COOKIE, vid, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }
  return { userId: null, voterKey: vid };
}
