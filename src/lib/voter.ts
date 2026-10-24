import { cookies } from "next/headers";
import { auth } from "@/lib/auth";

const COOKIE = "imbrgr_vid";

/**
 * Resolve the caller's identity. Pass `persist: false` from read-only routes (file serving, metadata GETs):
 * minting a cookie there lets many concurrent first-visit requests each set a different id, and the last
 * Set-Cookie wins, which orphans anything the visitor just created.
 */
export async function getVoterKey(
  options: { persist?: boolean } = {},
): Promise<{ userId: string | null; voterKey: string }> {
  const { persist = true } = options;
  const session = await auth();
  if (session?.user?.id) {
    return { userId: session.user.id, voterKey: `u:${session.user.id}` };
  }
  const jar = await cookies();
  let vid = jar.get(COOKIE)?.value;
  if (!vid) {
    vid = `a:${crypto.randomUUID()}`;
    if (persist) {
      jar.set(COOKIE, vid, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  }
  return { userId: null, voterKey: vid };
}
